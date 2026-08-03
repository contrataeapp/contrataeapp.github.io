-- V10 · controle simples de aprovação
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS approval_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS specialties TEXT;

CREATE INDEX IF NOT EXISTS idx_professionals_approval_requested ON professionals (approval_requested);
