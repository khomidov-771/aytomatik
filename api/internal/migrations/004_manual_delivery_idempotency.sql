-- A browser-generated request id is committed before the external provider
-- call. Repeating an ambiguous HTTP request therefore cannot send a second DM.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_manual_request_uidx
  ON messages(conversation_id,client_request_id)
  WHERE client_request_id IS NOT NULL;
