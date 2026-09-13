-- v11.3.33 - Rascunho de portfólio + legendas por imagem
-- Rode UMA VEZ no Supabase SQL Editor ANTES de testar a v11.3.33.
-- Seguro: não apaga imagens existentes. Linhas antigas permanecem publicadas.

ALTER TABLE public.professional_profession_portfolio
    ADD COLUMN IF NOT EXISTS caption text,
    ADD COLUMN IF NOT EXISTS draft_caption text,
    ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS pending_delete boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Garante que todo o acervo anterior continue público após a migração.
UPDATE public.professional_profession_portfolio
SET is_published = true
WHERE is_published IS NULL;

UPDATE public.professional_profession_portfolio
SET pending_delete = false
WHERE pending_delete IS NULL;

CREATE INDEX IF NOT EXISTS idx_profession_portfolio_publish_state
    ON public.professional_profession_portfolio (profession_profile_id, is_published, pending_delete, position, created_at DESC);

-- Mantém as permissões já usadas pelo MVP.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profession_portfolio TO anon, authenticated, service_role;

-- Mantém RLS compatível com o SQL 09.
ALTER TABLE public.professional_profession_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profession_portfolio NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS professional_profession_portfolio_all_contratae ON public.professional_profession_portfolio;
CREATE POLICY professional_profession_portfolio_all_contratae
ON public.professional_profession_portfolio
FOR ALL TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Conferência opcional:
-- SELECT id, slot, caption, draft_caption, is_published, pending_delete
-- FROM public.professional_profession_portfolio
-- ORDER BY slot, position, created_at DESC;
