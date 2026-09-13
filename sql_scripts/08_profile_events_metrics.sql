-- v11.3.26 - Métricas simples por profissão
-- Rode no Supabase SQL Editor para habilitar visitas/cliques por profissão na dashboard.
-- Seguro para produção: só cria tabela/índices se não existirem, não apaga dados.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.professional_profile_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    profession_slug text,
    profession_name text,
    event_type text NOT NULL CHECK (event_type IN ('profile_view','contact_click')),
    visitor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    source_url text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_events_profession_type_date
    ON public.professional_profile_events (professional_id, profession_slug, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_events_professional_date
    ON public.professional_profile_events (professional_id, created_at DESC);

ALTER TABLE public.professional_profile_events DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.professional_profile_events TO anon, authenticated, service_role;
