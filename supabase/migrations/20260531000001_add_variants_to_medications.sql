-- Add new columns to existing medications table (safe, idempotent)
ALTER TABLE public.medications
ADD COLUMN IF NOT EXISTS default_dosage          TEXT    DEFAULT '',
ADD COLUMN IF NOT EXISTS default_duration        TEXT    DEFAULT '',
ADD COLUMN IF NOT EXISTS default_frequency_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_frequency_unit  TEXT    DEFAULT 'comprimé(s)',
ADD COLUMN IF NOT EXISTS default_timing          TEXT    DEFAULT 'apres',
ADD COLUMN IF NOT EXISTS variants                JSONB   DEFAULT '[]'::jsonb;

-- Seed/update common medications with defaults
INSERT INTO public.medications (name, default_dosage, default_duration, default_frequency_count, default_frequency_unit, default_timing, variants) VALUES
('Paracétamol',   '1000mg', '3 jours', 3, 'comprimé(s)', 'apres',   '[{"dosage":"1000mg","duration":"3 jours","frequency_count":3,"frequency_unit":"comprimé(s)","timing":"apres"},{"dosage":"500mg","duration":"5 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"avant"}]'),
('Ibuprofène',    '400mg',  '3 jours', 3, 'comprimé(s)', 'apres',   '[{"dosage":"400mg","duration":"3 jours","frequency_count":3,"frequency_unit":"comprimé(s)","timing":"apres"},{"dosage":"600mg","duration":"5 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"apres"}]'),
('Amoxicilline',  '500mg',  '7 jours', 3, 'comprimé(s)', 'apres',   '[{"dosage":"500mg","duration":"7 jours","frequency_count":3,"frequency_unit":"comprimé(s)","timing":"apres"},{"dosage":"1g","duration":"7 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"avant"}]'),
('Augmentin',     '1g',     '7 jours', 2, 'comprimé(s)', 'apres',   '[{"dosage":"1g","duration":"7 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"apres"},{"dosage":"500mg","duration":"5 jours","frequency_count":3,"frequency_unit":"comprimé(s)","timing":"apres"}]'),
('Flagyl',        '500mg',  '7 jours', 3, 'comprimé(s)', 'apres',   '[{"dosage":"500mg","duration":"7 jours","frequency_count":3,"frequency_unit":"comprimé(s)","timing":"apres"}]'),
('Ketoprofène',   '100mg',  '5 jours', 2, 'comprimé(s)', 'apres',   '[{"dosage":"100mg","duration":"5 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"apres"}]'),
('Prednisolone',  '20mg',   '5 jours', 1, 'comprimé(s)', 'avant',   '[{"dosage":"20mg","duration":"5 jours","frequency_count":1,"frequency_unit":"comprimé(s)","timing":"avant"},{"dosage":"40mg","duration":"3 jours","frequency_count":1,"frequency_unit":"comprimé(s)","timing":"avant"}]'),
('Amoxiclav',     '1g',     '7 jours', 2, 'comprimé(s)', 'apres',   '[{"dosage":"1g","duration":"7 jours","frequency_count":2,"frequency_unit":"comprimé(s)","timing":"apres"}]'),
('Tramadol',      '50mg',   '3 jours', 3, 'gélule(s)',   'apres',   '[{"dosage":"50mg","duration":"3 jours","frequency_count":3,"frequency_unit":"gélule(s)","timing":"apres"}]'),
('Hexoral',       '0.1%',   '10 jours',3, 'bain de bouche','apres', '[{"dosage":"0.1%","duration":"10 jours","frequency_count":3,"frequency_unit":"bain de bouche","timing":"apres"}]')
ON CONFLICT (name) DO UPDATE SET
  default_dosage          = EXCLUDED.default_dosage,
  default_duration        = EXCLUDED.default_duration,
  default_frequency_count = EXCLUDED.default_frequency_count,
  default_frequency_unit  = EXCLUDED.default_frequency_unit,
  default_timing          = EXCLUDED.default_timing,
  variants                = EXCLUDED.variants;
