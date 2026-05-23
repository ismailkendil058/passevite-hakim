ALTER TABLE labo_orders ADD COLUMN doctor_id UUID REFERENCES doctors(id);
