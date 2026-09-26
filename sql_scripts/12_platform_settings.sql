-- Contrataê v11.3.43
-- Configurações institucionais editáveis pelo ADM.
-- Execute uma única vez no Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    contact_email TEXT,
    location_text TEXT,
    facebook_url TEXT,
    facebook_active BOOLEAN NOT NULL DEFAULT FALSE,
    instagram_url TEXT,
    instagram_active BOOLEAN NOT NULL DEFAULT FALSE,
    x_url TEXT,
    x_active BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_number TEXT,
    whatsapp_active BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (
    id,
    contact_email,
    location_text,
    facebook_active,
    instagram_active,
    x_active,
    whatsapp_active,
    whatsapp_message
)
VALUES (
    'main',
    'time.contratae@gmail.com',
    'Taquaritinga - SP',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    'Olá, encontrei o Contrataê e gostaria de falar com a equipe.'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- O navegador não grava diretamente nesta tabela.
-- Leitura/escrita é feita pelo servidor; SERVICE_ROLE ignora RLS.
-- Não criamos policy pública de UPDATE para não expor configurações do site.

COMMENT ON TABLE public.platform_settings IS
'Configurações institucionais do Contrataê gerenciadas pelo Painel ADM.';
