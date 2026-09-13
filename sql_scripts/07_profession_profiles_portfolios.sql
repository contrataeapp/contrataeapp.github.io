-- v11.3.25 - Profissões e portfólios separados por profissão
-- Rode no Supabase SQL Editor antes de testar "Minhas Profissões" e portfólio por profissão.

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

CREATE INDEX IF NOT EXISTS idx_profession_profiles_professional
    ON public.professional_profession_profiles (professional_id, slot);

CREATE INDEX IF NOT EXISTS idx_profession_profiles_slug
    ON public.professional_profession_profiles (profession_slug, status);

CREATE INDEX IF NOT EXISTS idx_profession_portfolio_profile
    ON public.professional_profession_portfolio (profession_profile_id, position, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_profession_profile_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_profession_profile_updated_at ON public.professional_profession_profiles;
CREATE TRIGGER trg_touch_profession_profile_updated_at
BEFORE UPDATE ON public.professional_profession_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_profession_profile_updated_at();

ALTER TABLE public.professional_profession_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profession_portfolio DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profession_profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profession_portfolio TO anon, authenticated, service_role;
