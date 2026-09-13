-- Correção rápida para a notificação/Meus Serviços funcionar no Supabase
-- Pode rodar mesmo que a tabela já exista.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.contact_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_name text,
  client_email text,
  client_phone text,
  professional_category text,
  message text,
  source_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'archived')),
  contacted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  professional_note text
);

CREATE INDEX IF NOT EXISTS idx_contact_leads_professional_status
  ON public.contact_leads (professional_id, status, contacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_leads_client
  ON public.contact_leads (client_id, contacted_at DESC);

ALTER TABLE public.contact_leads DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO service_role;
