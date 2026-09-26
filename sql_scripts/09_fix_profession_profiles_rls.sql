-- v11.3.29 - Correção de permissões/RLS das profissões e portfólios por profissão
-- Rode no Supabase SQL Editor se "Publicar alterações" mostrar erro de RLS.
-- Seguro: não apaga dados. Só garante tabela, permissões e políticas permissivas para o MVP.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.professional_profession_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    slot integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    profession_name text NOT NULL,
    profession_slug text,
    description text,
    specialties text,
    availability text,
    price_info text,
    price_value numeric(10,2),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','paused','archived')),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (professional_id, slot)
);

CREATE TABLE IF NOT EXISTS public.professional_profession_portfolio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    profession_profile_id uuid NOT NULL REFERENCES public.professional_profession_profiles(id) ON DELETE CASCADE,
    slot integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
    image_url text NOT NULL,
    position integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_profession_profiles_professional
    ON public.professional_profession_profiles (professional_id, slot);
CREATE INDEX IF NOT EXISTS idx_profession_profiles_slug
    ON public.professional_profession_profiles (profession_slug, status);
CREATE INDEX IF NOT EXISTS idx_profession_portfolio_profile
    ON public.professional_profession_portfolio (profession_profile_id, position, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_events_profession_type_date
    ON public.professional_profile_events (professional_id, profession_slug, event_type, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profession_profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profession_portfolio TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.professional_profile_events TO anon, authenticated, service_role;

-- Mantém RLS ligado com política permissiva. Assim evita bloqueio mesmo em bases onde o RLS foi religado depois.
ALTER TABLE public.professional_profession_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profession_profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profession_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profession_portfolio NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profile_events NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS professional_profession_profiles_all_contratae ON public.professional_profession_profiles;
CREATE POLICY professional_profession_profiles_all_contratae
ON public.professional_profession_profiles
FOR ALL TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS professional_profession_portfolio_all_contratae ON public.professional_profession_portfolio;
CREATE POLICY professional_profession_portfolio_all_contratae
ON public.professional_profession_portfolio
FOR ALL TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS professional_profile_events_all_contratae ON public.professional_profile_events;
CREATE POLICY professional_profile_events_all_contratae
ON public.professional_profile_events
FOR ALL TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Teste rápido após publicar uma alteração:
-- SELECT * FROM public.professional_profession_profiles ORDER BY updated_at DESC LIMIT 20;
