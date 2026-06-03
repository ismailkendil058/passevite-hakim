-- Fix labo_orders_status_check constraint to accept French status values
-- used by the application: 'En cours', 'Au labo', 'Livré', 'Problème'

ALTER TABLE public.labo_orders
  DROP CONSTRAINT IF EXISTS labo_orders_status_check;

ALTER TABLE public.labo_orders
  ADD CONSTRAINT labo_orders_status_check
  CHECK (status IN ('En cours', 'Au labo', 'Livré', 'Problème'));
