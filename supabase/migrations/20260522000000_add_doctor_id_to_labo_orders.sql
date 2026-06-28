ALTER TABLE IF EXISTS public.labo_orders ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.doctors(id);
