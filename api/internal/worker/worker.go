package worker

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/ids-automate/ids-automate/api/internal/domain"
	"github.com/ids-automate/ids-automate/api/internal/provider"
	"github.com/ids-automate/ids-automate/api/internal/rules"
	"github.com/ids-automate/ids-automate/api/internal/security"
	"github.com/ids-automate/ids-automate/api/internal/store"
	"github.com/redis/go-redis/v9"
)

type Job struct {
	EventID, WorkspaceID, AccountID string
	Event                           domain.CommentEvent
}
type Worker struct {
	store    *store.Store
	provider provider.Instagram
	cipher   *security.TokenCipher
	jobs     chan Job
	redis    *redis.Client
}

const maxAttempts = 5

func New(ctx context.Context, s *store.Store, p provider.Instagram, c *security.TokenCipher, redisURL string) *Worker {
	w := &Worker{store: s, provider: p, cipher: c, jobs: make(chan Job, 256)}
	if redisURL != "" {
		if options, err := redis.ParseURL(redisURL); err == nil {
			client := redis.NewClient(options)
			pingCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
			defer cancel()
			if client.Ping(pingCtx).Err() == nil {
				w.redis = client
			} else {
				_ = client.Close()
				slog.Warn("Redis unavailable; using in-process queue")
			}
		}
	}
	return w
}
func (w *Worker) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			if w.redis != nil {
				values, err := w.redis.BRPop(ctx, time.Second, "ids:instagram:jobs").Result()
				if err == nil && len(values) == 2 {
					var job Job
					if json.Unmarshal([]byte(values[1]), &job) == nil {
						w.claimAndProcess(ctx, job.EventID)
					}
				}
				if ctx.Err() != nil {
					return
				}
				w.recoverDue(ctx)
				continue
			}
			select {
			case <-ctx.Done():
				return
			case job := <-w.jobs:
				w.claimAndProcess(ctx, job.EventID)
			case <-ticker.C:
				w.recoverDue(ctx)
			}
		}
	}()
}

func (w *Worker) claimAndProcess(ctx context.Context, eventID string) {
	queued, err := w.store.ClaimQueuedEvent(ctx, eventID, maxAttempts)
	if errors.Is(err, store.ErrNotFound) {
		return
	}
	if err != nil {
		slog.Error("worker could not claim event", "event_id", eventID, "error", err)
		return
	}
	w.process(ctx, queued)
}

func (w *Worker) recoverDue(ctx context.Context) {
	for i := 0; i < 32 && ctx.Err() == nil; i++ {
		queued, err := w.store.ClaimQueuedEvent(ctx, "", maxAttempts)
		if errors.Is(err, store.ErrNotFound) {
			return
		}
		if err != nil {
			slog.Error("worker recovery claim failed", "error", err)
			return
		}
		w.process(ctx, queued)
	}
}
func (w *Worker) Enqueue(job Job) bool {
	if w.redis != nil {
		raw, err := json.Marshal(job)
		if err != nil {
			return false
		}
		return w.redis.LPush(context.Background(), "ids:instagram:jobs", raw).Err() == nil
	}
	select {
	case w.jobs <- job:
		return true
	default:
		return false
	}
}
func (w *Worker) Depth() int {
	if w.redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		value, err := w.redis.LLen(ctx, "ids:instagram:jobs").Result()
		if err == nil {
			return int(value)
		}
	}
	return len(w.jobs)
}

func (w *Worker) process(ctx context.Context, queued store.QueuedCommentEvent) {
	job := Job{EventID: queued.EventID, WorkspaceID: queued.WorkspaceID, AccountID: queued.AccountID, Event: queued.Event}
	providerAccountID, encrypted, accountProvider, scopes, err := w.store.AccountSecretByID(ctx, job.WorkspaceID, job.AccountID)
	if err != nil {
		if saveErr := w.finish(ctx, job, nil, "failed", "account_unavailable", "connected account could not be loaded"); saveErr != nil {
			slog.Error("worker account lookup and failure persistence failed", "event_id", job.EventID, "error", err, "persistence_error", saveErr)
		}
		return
	}
	if accountProvider != w.provider.Name() || providerAccountID != job.Event.AccountID {
		_ = w.finish(ctx, job, nil, "failed", "provider_mismatch", "connected account provider does not match active provider")
		return
	}
	if job.Event.ParticipantID == job.Event.AccountID {
		_ = w.finish(ctx, job, nil, "skipped_policy", "self_comment", "self-trigger prevention")
		return
	}
	if job.Event.CreatedAt.Before(time.Now().Add(-7 * 24 * time.Hour)) {
		_ = w.finish(ctx, job, nil, "skipped_policy", "reply_window_expired", "private reply window expired")
		return
	}
	if job.Event.IsLive {
		_ = w.finish(ctx, job, nil, "skipped_policy", "live_state_unverified", "live broadcast state cannot be verified")
		return
	}
	items, err := w.store.ActiveRules(ctx, job.WorkspaceID, job.AccountID)
	if err != nil {
		w.retryOrFail(ctx, queued, nil, "rules_unavailable", "automation rules could not be loaded")
		return
	}
	var match *domain.AutomationRule
	bestSpecificity := -1
	for i := range items {
		keyword, matched := rules.MatchKeyword(items[i], job.Event)
		if !matched {
			continue
		}
		specificity := len([]rune(rules.Normalize(keyword)))
		if match == nil || specificity > bestSpecificity {
			match = &items[i]
			bestSpecificity = specificity
		}
	}
	if match == nil {
		_ = w.finish(ctx, job, nil, "skipped_no_match", "", "")
		return
	}
	executionID, followStatus, err := w.store.EnsureExecution(ctx, job.EventID, job.WorkspaceID, match.ID)
	if err != nil {
		w.retryOrFail(ctx, queued, match, "execution_unavailable", "execution state could not be created")
		return
	}
	token, err := w.cipher.Decrypt(encrypted)
	if err != nil {
		_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "token_unavailable", "encrypted token could not be read", true)
		return
	}

	if match.FollowVerificationEnabled && followStatus == domain.FollowerNotChecked {
		state, acquired, markerErr := w.store.BeginAction(ctx, job.WorkspaceID, executionID, "follow_check", "", false)
		if markerErr != nil {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_marker_unavailable", "follow check state could not be persisted", true)
			return
		}
		if acquired {
			checked, checkErr := w.provider.CheckFollowerStatus(ctx, token, job.Event.ParticipantID, scopes)
			followStatus = checked
			actionStatus := "succeeded"
			errorCode := ""
			errorMessage := ""
			if checkErr != nil {
				followStatus = domain.FollowerUnknown
				actionStatus = "failed"
				errorCode = provider.ErrorCode(checkErr)
				errorMessage = "follow status could not be confirmed"
			}
			if persistErr := w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "follow_check", actionStatus, string(followStatus), "", errorCode, errorMessage); persistErr != nil {
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_result_unavailable", "follow check result could not be persisted", true)
				return
			}
			if persistErr := w.store.SetExecutionFollowStatus(ctx, job.WorkspaceID, executionID, followStatus); persistErr != nil {
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_status_unavailable", "follow status could not be persisted", true)
				return
			}
		} else {
			followStatus = parseFollowerStatus(state.Outcome)
			if followStatus == domain.FollowerNotChecked {
				followStatus = domain.FollowerUnknown
			}
			if persistErr := w.store.SetExecutionFollowStatus(ctx, job.WorkspaceID, executionID, followStatus); persistErr != nil {
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_status_unavailable", "follow status could not be persisted", true)
				return
			}
		}
	} else if !match.FollowVerificationEnabled {
		followStatus = domain.FollowerNotChecked
		_, acquired, markerErr := w.store.BeginAction(ctx, job.WorkspaceID, executionID, "follow_check", "", false)
		if markerErr != nil {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_marker_unavailable", "disabled follow state could not be persisted", true)
			return
		}
		if acquired {
			if persistErr := w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "follow_check", "skipped", string(followStatus), "", "", "verification disabled"); persistErr != nil {
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_result_unavailable", "disabled follow result could not be persisted", true)
				return
			}
		}
		if persistErr := w.store.SetExecutionFollowStatus(ctx, job.WorkspaceID, executionID, followStatus); persistErr != nil {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "follow_status_unavailable", "follow status could not be persisted", true)
			return
		}
	}

	decision := decideWorkflow(*match, followStatus)
	if decision.SendPrivate {
		state, acquired, markerErr := w.store.BeginAction(ctx, job.WorkspaceID, executionID, "private_reply", match.PrivateReplyText, false)
		if markerErr != nil {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "private_reply_marker_unavailable", "private reply state could not be persisted", true)
			return
		}
		if acquired {
			delivery, deliveryErr := w.provider.SendPrivateReply(ctx, token, providerAccountID, job.Event.CommentID, match.PrivateReplyText)
			if deliveryErr != nil {
				actionStatus := "failed"
				finalStatus := "failed"
				if provider.IsAmbiguous(deliveryErr) {
					actionStatus = "unknown"
					finalStatus = "delivery_state_unknown"
				}
				code := provider.ErrorCode(deliveryErr)
				_ = w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "private_reply", actionStatus, "", "", code, "private reply was not confirmed")
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, finalStatus, code, "private reply was not confirmed; public success reply was not sent", true)
				return
			}
			if err = w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "private_reply", "succeeded", "delivered", delivery.MessageID, "", ""); err != nil {
				slog.Error("private reply result could not be stored", "event_id", job.EventID, "error", err)
				return
			}
			if err = w.store.RecordPrivateReplyMessage(ctx, job.WorkspaceID, *match, job.Event, delivery.MessageID); err != nil {
				slog.Error("private reply inbox record could not be stored", "event_id", job.EventID, "error", err)
			}
		} else if state.Status != "succeeded" {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "delivery_state_unknown", "private_reply_duplicate_blocked", "a previous private reply attempt was not confirmed", true)
			return
		}
	} else {
		_, acquired, markerErr := w.store.BeginAction(ctx, job.WorkspaceID, executionID, "private_reply", "", false)
		if markerErr != nil {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "private_reply_marker_unavailable", "skipped private reply state could not be persisted", true)
			return
		}
		if acquired {
			if persistErr := w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "private_reply", "skipped", decision.PrivateOutcome, "", "", ""); persistErr != nil {
				_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "private_reply_result_unavailable", "skipped private reply result could not be persisted", true)
				return
			}
		}
	}

	publicText := decision.PublicText
	state, acquired, markerErr := w.store.BeginAction(ctx, job.WorkspaceID, executionID, "public_reply", publicText, true)
	if markerErr != nil {
		_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "failed", "public_reply_marker_unavailable", "public reply state could not be persisted", true)
		return
	}
	if !acquired {
		if state.Status == "succeeded" {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "completed", "", "", true)
			return
		}
		status := "failed"
		code := "public_reply_failed"
		if state.Status == "sending" || state.Status == "unknown" {
			status = "delivery_state_unknown"
			code = "public_reply_outcome_unknown"
		}
		_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, status, code, "public comment reply was not confirmed", true)
		return
	}
	if state.MessageText != "" {
		publicText = state.MessageText
	}
	publicDelivery, publicErr := w.provider.SendPublicCommentReply(ctx, token, job.Event.CommentID, publicText)
	if publicErr != nil {
		code := provider.ErrorCode(publicErr)
		actionStatus := "failed"
		finalStatus := "failed"
		if provider.IsAmbiguous(publicErr) {
			actionStatus = "unknown"
			finalStatus = "delivery_state_unknown"
		} else if provider.IsRetryable(publicErr) && state.AttemptCount < 3 {
			actionStatus = "failed_retryable"
			finalStatus = "public_reply_retry_pending"
		}
		_ = w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "public_reply", actionStatus, decision.PublicOutcome, "", code, "public comment reply was not confirmed")
		if actionStatus == "failed_retryable" {
			_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, finalStatus, code, "only the failed public reply will be retried", false)
			delay := time.Duration(1<<min(queued.AttemptCount, 6)) * time.Second
			if retryErr := w.store.RetryEvent(ctx, job.EventID, job.WorkspaceID, code, delay); retryErr != nil {
				slog.Error("public reply retry could not be scheduled", "event_id", job.EventID, "error", retryErr)
			}
			return
		}
		_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, finalStatus, code, "public comment reply was not confirmed", true)
		return
	}
	if err = w.store.CompleteAction(ctx, job.WorkspaceID, executionID, "public_reply", "succeeded", decision.PublicOutcome, publicDelivery.MessageID, "", ""); err != nil {
		slog.Error("public reply result could not be stored", "event_id", job.EventID, "error", err)
		return
	}
	_ = w.store.FinishExecution(ctx, job.WorkspaceID, executionID, "completed", "", "", true)
}

type workflowDecision struct {
	SendPrivate    bool
	PrivateOutcome string
	PublicOutcome  string
	PublicText     string
}

func decideWorkflow(rule domain.AutomationRule, status domain.FollowerStatus) workflowDecision {
	if !rule.FollowVerificationEnabled || status == domain.Follower {
		return workflowDecision{SendPrivate: true, PublicOutcome: "private_reply_confirmed", PublicText: rule.PublicSuccessReplyText}
	}
	if status == domain.NotFollower {
		return workflowDecision{PrivateOutcome: "not_follower", PublicOutcome: "not_follower", PublicText: rule.PublicNotFollowerReplyText}
	}
	if rule.UnknownFallbackPolicy == "send_private_reply" {
		return workflowDecision{SendPrivate: true, PublicOutcome: "unknown_fallback_private_reply_confirmed", PublicText: rule.PublicSuccessReplyText}
	}
	return workflowDecision{PrivateOutcome: "unknown_follow_status", PublicOutcome: "unknown_neutral", PublicText: rule.PublicUnknownReplyText}
}

func parseFollowerStatus(value string) domain.FollowerStatus {
	switch domain.FollowerStatus(value) {
	case domain.Follower, domain.NotFollower, domain.FollowerUnknown:
		return domain.FollowerStatus(value)
	default:
		return domain.FollowerNotChecked
	}
}

func (w *Worker) finish(ctx context.Context, job Job, rule *domain.AutomationRule, status, code, message string) error {
	ruleID := ""
	if rule != nil {
		ruleID = rule.ID
	}
	executionID, _, err := w.store.EnsureExecution(ctx, job.EventID, job.WorkspaceID, ruleID)
	if err != nil {
		return err
	}
	return w.store.FinishExecution(ctx, job.WorkspaceID, executionID, status, code, message, true)
}

func (w *Worker) retryOrFail(ctx context.Context, queued store.QueuedCommentEvent, rule *domain.AutomationRule, code, message string) {
	if queued.AttemptCount >= maxAttempts {
		job := Job{EventID: queued.EventID, WorkspaceID: queued.WorkspaceID, AccountID: queued.AccountID, Event: queued.Event}
		if err := w.finish(ctx, job, rule, "failed", code, message); err != nil {
			slog.Error("worker could not persist terminal failure", "event_id", queued.EventID, "error", err)
		}
		return
	}
	delay := time.Duration(1<<min(queued.AttemptCount, 6)) * time.Second
	if err := w.store.RetryEvent(ctx, queued.EventID, queued.WorkspaceID, code, delay); err != nil {
		slog.Error("worker could not schedule retry", "event_id", queued.EventID, "error", err)
	}
}

