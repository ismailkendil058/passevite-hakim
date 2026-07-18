-- Consolidated Supabase schema + policies + seeds for PasseVite
-- Run this in Supabase SQL editor (project-level) to create the required schema.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) app_role enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('receptionist','manager');
  END IF;
END$$;

-- 2) user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 3) security-definer helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4) profiles table and trigger to create on auth.user creation
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5) doctors
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initial char(1) NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  password text
);

-- 6) sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid REFERENCES auth.users(id) NOT NULL,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 7) queue_entries
-- 9) appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone text NOT NULL,
  client_name text NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_at timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','coming','denied','no_answer','attended')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  phone text NOT NULL,
  state text NOT NULL CHECK (state IN ('U','N','R')),
  doctor_id uuid REFERENCES public.doctors(id) NOT NULL,
  state_number integer NOT NULL,
  client_id text NOT NULL,
  position integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','completed','in_cabinet')),
  created_at timestamptz DEFAULT now(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL
);

-- 8) completed_clients
CREATE TABLE IF NOT EXISTS public.completed_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id uuid,
  session_id uuid,
  client_name text NOT NULL,
  phone text NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id) NOT NULL,
  client_id text NOT NULL,
  state text NOT NULL,
  treatment text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  tranche_paid numeric NOT NULL DEFAULT 0,
  receptionist_id uuid,
  completed_at timestamptz DEFAULT now(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL
);

-- Ensure FK behaviour for queue_entry_id -> set null on delete
ALTER TABLE IF EXISTS public.completed_clients DROP CONSTRAINT IF EXISTS completed_clients_queue_entry_id_fkey;
ALTER TABLE IF EXISTS public.completed_clients
  ADD CONSTRAINT completed_clients_queue_entry_id_fkey
  FOREIGN KEY (queue_entry_id) REFERENCES public.queue_entries(id) ON DELETE SET NULL;

-- 10) medications & prescriptions
CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  patient_name text NOT NULL,
  age integer,
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  medications jsonb NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 11) invoices, suppliers, products, invoice_items
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('check','caisse','ccp','manager payment')),
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 1,
  expiration_date date,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 12) expenses (manager)
-- Use column name 'title' to reflect latest migrations
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 13) labo_orders
CREATE TABLE IF NOT EXISTS public.labo_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reception date NOT NULL DEFAULT CURRENT_DATE,
  client_name text NOT NULL,
  type_travail text NOT NULL,
  teinte text,
  status text NOT NULL DEFAULT 'En cours',
  devis numeric NOT NULL DEFAULT 0,
  versement numeric NOT NULL DEFAULT 0,
  reste numeric NOT NULL DEFAULT 0,
  patient_phone text,
  doctor_id uuid REFERENCES public.doctors(id),
  created_at timestamptz DEFAULT now()
);

-- Labo orders status check (French statuses)
ALTER TABLE public.labo_orders DROP CONSTRAINT IF EXISTS labo_orders_status_check;
ALTER TABLE public.labo_orders
  ADD CONSTRAINT labo_orders_status_check CHECK (status IN ('En cours','Au labo','Livré','Problème'));

-- 14) satisfied_stats and increment function
CREATE TABLE IF NOT EXISTS public.satisfied_stats (
  date date PRIMARY KEY,
  count integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.increment_satisfied_count()
RETURNS void AS $$
BEGIN
  INSERT INTO public.satisfied_stats (date, count)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (date) DO UPDATE SET count = public.satisfied_stats.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15) feedbacks
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 16) Custom auth roles table (manual auth used by app)
-- This is included from setup_custom_auth.sql
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager','receptionist')),
  created_at timestamptz DEFAULT now()
);

-- Seed initial manual users (only if not present)
INSERT INTO public.roles (username, password, role)
SELECT 'admin','admin123','manager'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE username = 'admin');

INSERT INTO public.roles (username, password, role)
SELECT 'accueil','accueil123','receptionist'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE username = 'accueil');

-- Allow anonymous access to the manual auth roles table so the app can validate credentials.
GRANT SELECT ON public.roles TO anon;

-- 17) Enable RLS and create policies (apply per table as in migrations)
-- user_roles
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read own roles" ON public.user_roles;
CREATE POLICY "Authenticated can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- doctors
ALTER TABLE IF EXISTS public.doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read doctors" ON public.doctors;
CREATE POLICY "Anyone can read doctors" ON public.doctors FOR SELECT USING (true);

-- sessions
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated can read sessions" ON public.sessions;
CREATE POLICY "Authenticated can read sessions" ON public.sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Receptionist can insert sessions" ON public.sessions;
CREATE POLICY "Receptionist can insert sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Receptionist can update sessions" ON public.sessions;
CREATE POLICY "Receptionist can update sessions" ON public.sessions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));

-- queue_entries
ALTER TABLE IF EXISTS public.queue_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can insert queue" ON public.queue_entries;
DROP POLICY IF EXISTS "Authenticated can update queue" ON public.queue_entries;
DROP POLICY IF EXISTS "Authenticated can delete queue" ON public.queue_entries;
DROP POLICY IF EXISTS "Anyone can read queue" ON public.queue_entries;
CREATE POLICY "Anyone can read queue" ON public.queue_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Receptionist can insert queue" ON public.queue_entries;
CREATE POLICY "Receptionist can insert queue" ON public.queue_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Receptionist can update queue" ON public.queue_entries;
CREATE POLICY "Receptionist can update queue" ON public.queue_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Receptionist can delete queue" ON public.queue_entries;
CREATE POLICY "Receptionist can delete queue" ON public.queue_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));

-- appointments
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allows authenticated users to manage appointments" ON public.appointments;
CREATE POLICY "Anyone can manage appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon;

-- completed_clients
ALTER TABLE IF EXISTS public.completed_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read completed" ON public.completed_clients;
DROP POLICY IF EXISTS "Receptionist can insert completed" ON public.completed_clients;
DROP POLICY IF EXISTS "Authenticated can insert completed" ON public.completed_clients;
DROP POLICY IF EXISTS "Authenticated can update completed" ON public.completed_clients;
DROP POLICY IF EXISTS "Authenticated can delete completed" ON public.completed_clients;
CREATE POLICY "Anyone can read completed" ON public.completed_clients FOR SELECT USING (true);
CREATE POLICY "Anyone can insert completed" ON public.completed_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update completed" ON public.completed_clients FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete completed" ON public.completed_clients FOR DELETE USING (true);

-- profiles RLS
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- prescriptions & medications
ALTER TABLE IF EXISTS public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read medications" ON public.medications;
CREATE POLICY "Public read medications" ON public.medications FOR ALL USING (true);
DROP POLICY IF EXISTS "Authenticated insert prescriptions" ON public.prescriptions;
CREATE POLICY "Authenticated insert prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated read prescriptions" ON public.prescriptions;
CREATE POLICY "Authenticated read prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated update prescriptions" ON public.prescriptions;
CREATE POLICY "Authenticated update prescriptions" ON public.prescriptions FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated delete prescriptions" ON public.prescriptions;
CREATE POLICY "Authenticated delete prescriptions" ON public.prescriptions FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- invoices/factures policies
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can handle suppliers" ON public.suppliers;
CREATE POLICY "Managers can handle suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Managers can handle products" ON public.products;
CREATE POLICY "Managers can handle products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Managers can handle invoices" ON public.invoices;
CREATE POLICY "Managers can handle invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
DROP POLICY IF EXISTS "Managers can handle invoice_items" ON public.invoice_items;
CREATE POLICY "Managers can handle invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- expenses policies (manager only)
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can do everything with expenses" ON public.expenses;
CREATE POLICY "Managers can do everything with expenses" ON public.expenses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- labo_orders policies
ALTER TABLE IF EXISTS public.labo_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated insert labo_orders" ON public.labo_orders;
CREATE POLICY "Authenticated insert labo_orders" ON public.labo_orders FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated read labo_orders" ON public.labo_orders;
CREATE POLICY "Authenticated read labo_orders" ON public.labo_orders FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated update labo_orders" ON public.labo_orders;
CREATE POLICY "Authenticated update labo_orders" ON public.labo_orders FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated delete labo_orders" ON public.labo_orders;
CREATE POLICY "Authenticated delete labo_orders" ON public.labo_orders FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- satisfied_stats policies
CREATE POLICY "Public insert satisfied_stats" ON public.satisfied_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update satisfied_stats" ON public.satisfied_stats FOR UPDATE USING (true) WITH CHECK (true);

-- feedbacks policy
CREATE POLICY "Public insert feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (true);

-- 18) Indexes and unique constraints applied by migrations
-- Unique index to prevent duplicate active phone entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'queue_entries_phone_active_idx' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX queue_entries_phone_active_idx ON public.queue_entries (phone) WHERE (status IN ('waiting','in_cabinet'));
  END IF;
END$$;

-- Labo indexes
CREATE INDEX IF NOT EXISTS idx_labo_orders_doctor ON public.labo_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_labo_orders_date ON public.labo_orders(date_reception);
CREATE INDEX IF NOT EXISTS idx_labo_orders_status ON public.labo_orders(status);

-- Prescriptions indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON public.prescriptions(prescription_date);

-- Expenses and invoices indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
-- invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON public.invoice_items(product_id);

-- 19) Seeds for doctors
INSERT INTO public.doctors (name, initial)
SELECT 'Djihane','D' WHERE NOT EXISTS (SELECT 1 FROM public.doctors WHERE initial='D');
INSERT INTO public.doctors (name, initial)
SELECT 'Zineb','Z' WHERE NOT EXISTS (SELECT 1 FROM public.doctors WHERE initial='Z');
INSERT INTO public.doctors (name, initial)
SELECT 'Imane','I' WHERE NOT EXISTS (SELECT 1 FROM public.doctors WHERE initial='I');
INSERT INTO public.doctors (name, initial)
SELECT 'Mohamed','M' WHERE NOT EXISTS (SELECT 1 FROM public.doctors WHERE initial='M');

-- 20) Make receptionist_id nullable and drop obsolete FK if present
ALTER TABLE IF EXISTS public.completed_clients ALTER COLUMN receptionist_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.completed_clients DROP CONSTRAINT IF EXISTS completed_clients_receptionist_id_fkey;

-- 21) Make session_id optional in queue_entries and completed_clients
ALTER TABLE IF EXISTS public.queue_entries ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.completed_clients ALTER COLUMN session_id DROP NOT NULL;

-- 22) Ensure appointment link columns exist
ALTER TABLE IF EXISTS public.queue_entries ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.completed_clients ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 23) Fix invoices/products/suppliers created_by to text where needed (safe no-op if already text)
-- (Some environments require changing FK relationships; migrations set type to text)
DO $$
BEGIN
  -- Change created_by types to text to match runtime usage
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='created_by' AND data_type <> 'text') THEN
    ALTER TABLE public.expenses ALTER COLUMN created_by TYPE text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='created_by' AND data_type <> 'text') THEN
    ALTER TABLE public.suppliers ALTER COLUMN created_by TYPE text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='created_by' AND data_type <> 'text') THEN
    ALTER TABLE public.products ALTER COLUMN created_by TYPE text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='created_by' AND data_type <> 'text') THEN
    ALTER TABLE public.invoices ALTER COLUMN created_by TYPE text;
  END IF;
END$$;

-- 24) Realtime publication (best-effort: may require privileges)
-- Add common realtime tables to publication if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
      ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
      ALTER PUBLICATION supabase_realtime ADD TABLE public.labo_orders;
    EXCEPTION WHEN others THEN
      -- ignore if already added or cannot alter
      RAISE NOTICE 'Could not alter publication supabase_realtime: %', SQLERRM;
    END;
  END IF;
END$$;

-- 25) Final safety: ensure functions/triggers/policies exist as expected
-- (increment_satisfied_count already created above)

-- Done

-- Notes:
--  - Run this in the Supabase SQL Editor for your project.
--  - Some commands (publication modifications, auth schema interactions) may require elevated privileges.
--  - The app uses a custom public.roles table for manual authentication; passwords are stored in cleartext here for convenience (mimic of project). For production, replace with hashed passwords and secure policies.
