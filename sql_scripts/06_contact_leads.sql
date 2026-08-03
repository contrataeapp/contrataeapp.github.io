-- v11.3.23 - Contact leads robusto com RPC SECURITY DEFINER
-- Rode este SQL inteiro no Supabase SQL Editor.
-- Ele resolve o erro: new row violates row-level security policy for table "contact_leads".

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

COMMENT ON TABLE public.contact_leads IS 'Registra cliques protegidos de clientes no botão Contratar, gerando pendência para o profissional.';

-- Mantemos grants básicos. A gravação/leitura robusta será feita pelas funções abaixo.
GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contact_leads TO service_role;

-- Tenta deixar RLS desligado. Se algum ambiente religar RLS ou a chave do backend cair como anon,
-- as funções SECURITY DEFINER abaixo continuam permitindo o fluxo controlado pelo servidor.
ALTER TABLE public.contact_leads DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_contact_lead(
  p_professional_id uuid,
  p_client_id uuid,
  p_client_name text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_client_phone text DEFAULT NULL,
  p_professional_category text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_source_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.contact_leads (
    professional_id,
    client_id,
    client_name,
    client_email,
    client_phone,
    professional_category,
    message,
    source_url,
    status,
    contacted_at
  ) VALUES (
    p_professional_id,
    p_client_id,
    NULLIF(trim(COALESCE(p_client_name, '')), ''),
    NULLIF(trim(COALESCE(p_client_email, '')), ''),
    NULLIF(trim(COALESCE(p_client_phone, '')), ''),
    NULLIF(trim(COALESCE(p_professional_category, '')), ''),
    NULLIF(trim(COALESCE(p_message, '')), ''),
    NULLIF(trim(COALESCE(p_source_url, '')), ''),
    'pending',
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_professional_contact_leads(
  p_professional_id uuid,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.contact_leads
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.contact_leads
  WHERE professional_id = p_professional_id
    AND (p_status IS NULL OR status = p_status)
  ORDER BY contacted_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.update_contact_lead_status(
  p_lead_id uuid,
  p_professional_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_status NOT IN ('accepted', 'declined', 'archived') THEN
    RAISE EXCEPTION 'status inválido: %', p_status;
  END IF;

  UPDATE public.contact_leads
  SET status = p_status,
      professional_note = NULLIF(trim(COALESCE(p_note, '')), ''),
      responded_at = now()
  WHERE id = p_lead_id
    AND professional_id = p_professional_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contact_lead(uuid, uuid, text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_professional_contact_leads(uuid, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_contact_lead_status(uuid, uuid, text, text) TO anon, authenticated, service_role;

-- Teste rápido depois de um clique real:
-- SELECT * FROM public.contact_leads ORDER BY contacted_at DESC LIMIT 20;
