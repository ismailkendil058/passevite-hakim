-- Create labo_orders table for laboratory orders
CREATE TABLE IF NOT EXISTS public.labo_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_reception DATE NOT NULL DEFAULT CURRENT_DATE,
    client_name TEXT NOT NULL,
    type_travail TEXT NOT NULL,
    teinte TEXT,
    status TEXT NOT NULL DEFAULT 'En cours',
    devis NUMERIC NOT NULL DEFAULT 0,
    versement NUMERIC NOT NULL DEFAULT 0,
    patient_phone TEXT,
    doctor_id UUID REFERENCES public.doctors(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status check constraint (idempotent)
ALTER TABLE public.labo_orders DROP CONSTRAINT IF EXISTS labo_orders_status_check;
ALTER TABLE public.labo_orders
    ADD CONSTRAINT labo_orders_status_check
    CHECK (status IN ('En cours', 'Au labo', 'Livré', 'Problème'));

-- Enable RLS
ALTER TABLE public.labo_orders ENABLE ROW LEVEL SECURITY;

-- Policies: allow any authenticated Supabase user (app-level role checks happen in React)
CREATE POLICY "Authenticated insert labo_orders" ON public.labo_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read labo_orders" ON public.labo_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update labo_orders" ON public.labo_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete labo_orders" ON public.labo_orders FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_labo_orders_doctor ON public.labo_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_labo_orders_date ON public.labo_orders(date_reception);
CREATE INDEX IF NOT EXISTS idx_labo_orders_status ON public.labo_orders(status);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.labo_orders;
