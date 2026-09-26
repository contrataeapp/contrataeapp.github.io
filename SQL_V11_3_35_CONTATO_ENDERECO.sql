-- Contrataê v11.3.35 — contato e endereço profissional opcionais
-- Seguro para rodar mais de uma vez: apenas adiciona colunas se ainda não existirem.

ALTER TABLE professionals
    ADD COLUMN IF NOT EXISTS fixed_phone TEXT,
    ADD COLUMN IF NOT EXISTS address_street TEXT,
    ADD COLUMN IF NOT EXISTS address_number TEXT,
    ADD COLUMN IF NOT EXISTS address_complement TEXT,
    ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
    ADD COLUMN IF NOT EXISTS show_full_address BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN professionals.fixed_phone IS 'Telefone fixo opcional do profissional/empresa.';
COMMENT ON COLUMN professionals.show_full_address IS 'Quando true, permite exibir endereço profissional completo no perfil público.';
