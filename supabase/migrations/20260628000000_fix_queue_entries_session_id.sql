-- Make session_id optional in queue_entries so the queue works without an active session
ALTER TABLE public.queue_entries
  ALTER COLUMN session_id DROP NOT NULL;

-- Make session_id optional in completed_clients so completion works without an active session
ALTER TABLE public.completed_clients
  ALTER COLUMN session_id DROP NOT NULL;
