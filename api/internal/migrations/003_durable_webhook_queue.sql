ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS leased_at timestamptz;

DROP INDEX IF EXISTS webhooks_queue_idx;
CREATE INDEX webhooks_queue_idx
  ON webhook_events(processing_status,next_attempt_at,received_at)
  WHERE processing_status IN ('queued','processing');
