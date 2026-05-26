-- Final fix for expenses table to match the actual database schema
-- Based on the database screenshot: column is named 'title' not 'description'

-- 1. Ensure columns match the live database
-- If 'description' exists, rename it. If not, ignore.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'description') THEN
        ALTER TABLE public.expenses RENAME COLUMN description TO title;
    END IF;
END $$;

-- 2. Ensure types are correct for custom auth
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.expenses ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- 3. Apply similar fixes to other management tables
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_created_by_fkey;
ALTER TABLE public.suppliers ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_created_by_fkey;
ALTER TABLE public.products ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE public.invoices ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
