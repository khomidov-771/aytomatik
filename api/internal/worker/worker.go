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
	providerAccountID, encrypted, accountProvider, err := w.store.AccountSecretByID(ctx, job.WorkspaceID, job.AccountID)
	if err != nil {
		if saveErr := w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "failed", "", "account_unavailable", "connected account could not be loaded", w.provider.IsDemo()); saveErr != nil {
			slog.Error("worker account lookup and failure persistence failed", "event_id", job.EventID, "error", err, "persistence_error", saveErr)
		}
		return
	}
	if accountProvider != w.provider.Name() || providerAccountID != job.Event.AccountID {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "failed", "", "provider_mismatch", "connected account provider does not match active provider", w.provider.IsDemo())
		return
	}
	if job.Event.ParticipantID == job.Event.AccountID {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "skipped_policy", "", "self_comment", "self-trigger prevention", w.provider.IsDemo())
		return
	}
	if job.Event.CreatedAt.Before(time.Now().Add(-7 * 24 * time.Hour)) {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "skipped_policy", "", "reply_window_expired", "private reply window expired", w.provider.IsDemo())
		return
	}
	if job.Event.IsLive {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "skipped_policy", "", "live_state_unverified", "live broadcast state cannot be verified", w.provider.IsDemo())
		return
	}
	items, err := w.store.ActiveRules(ctx, job.WorkspaceID, job.AccountID)
	if err != nil {
		w.retryOrFail(ctx, queued, nil, "rules_unavailable", "automation rules could not be loaded")
		return
	}
	var match *domain.AutomationRule
	for i := range items {
		if rules.Matches(items[i], job.Event) {
			match = &items[i]
			break
		}
	}
	if match == nil {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, nil, job.Event, "skipped_no_match", "", "", "", w.provider.IsDemo())
		return
	}
	token, err := w.cipher.Decrypt(encrypted)
	if err != nil {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, match, job.Event, "failed", "", "token_unavailable", "encrypted token could not be read", w.provider.IsDemo())
		return
	}
	acquired, err := w.store.BeginDelivery(ctx, job.EventID, job.WorkspaceID, match.ID)
	if err != nil {
		w.retryOrFail(ctx, queued, match, "delivery_marker_unavailable", "delivery marker could not be persisted")
		return
	}
	if !acquired {
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, match, job.Event, "failed", "", "delivery_state_unknown", "a prior delivery attempt exists; automatic resend was blocked", w.provider.IsDemo())
		return
	}
	delivery, err := w.provider.SendPrivateReply(ctx, token, providerAccountID, job.Event.CommentID, match.ReplyText)
	if err != nil {
		code := "provider_error"
		if errors.Is(err, context.DeadlineExceeded) {
			code = "provider_timeout"
		}
		_ = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, match, job.Event, "failed", "", code, "provider rejected delivery; automatic resend was blocked", w.provider.IsDemo())
		return
	}
	if err = w.store.CompleteExecution(ctx, job.EventID, job.WorkspaceID, match, job.Event, "sent", delivery.MessageID, "", "", w.provider.IsDemo()); err != nil {
		slog.Error("worker could not persist delivery", "event_id", job.EventID, "error", err)
	}
}

func (w *Worker) retryOrFail(ctx context.Context, queued store.QueuedCommentEvent, rule *domain.AutomationRule, code, message string) {
	if queued.AttemptCount >= maxAttempts {
		if err := w.store.CompleteExecution(ctx, queued.EventID, queued.WorkspaceID, rule, queued.Event, "failed", "", code, message, w.provider.IsDemo()); err != nil {
			slog.Error("worker could not persist terminal failure", "event_id", queued.EventID, "error", err)
		}
		return
	}
	delay := time.Duration(1<<min(queued.AttemptCount, 6)) * time.Second
	if err := w.store.RetryEvent(ctx, queued.EventID, queued.WorkspaceID, code, delay); err != nil {
		slog.Error("worker could not schedule retry", "event_id", queued.EventID, "error", err)
	}
}
