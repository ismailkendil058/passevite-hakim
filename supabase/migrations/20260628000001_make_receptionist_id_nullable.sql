-- Make receptionist_id nullable and drop the obsolete auth.users FK
-- The app now uses a custom public.roles table for authentication,
-- so receptionist_id values are roles.id UUIDs, not auth.users UUIDs.

ALTER TABLE public.completed_clients ALTER COLUMN receptionist_id DROP NOT NULL;
ALTER TABLE public.completed_clients DROP CONSTRAINT IF EXISTS completed_clients_receptionist_id_fkey;