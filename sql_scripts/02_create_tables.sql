-- Script 02: Criação de Tabelas com Chaves Primárias

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Nulo para usuários OAuth
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    user_type user_type_enum, -- client ou professional
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professionals (
    user_id UUID PRIMARY KEY, -- FK para users.id
    category_id UUID NOT NULL, -- FK para categories.id
    description TEXT,
    price_info TEXT,
    availability TEXT,
    status professional_status_enum DEFAULT 'pending',
    payment_value NUMERIC(10, 2) DEFAULT 0.00,
    plan_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL, -- FK para professionals.user_id
    client_id UUID NOT NULL, -- FK para users.id (o cliente que avaliou)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status review_status_enum DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL, -- FK para professionals.user_id
    client_id UUID, -- FK para users.id (se o cliente for um usuário registrado)
    client_name TEXT, -- Nome do cliente, se não for usuário registrado
    service_description TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    status service_status_enum DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL, -- FK para users.id
    professional_id UUID NOT NULL, -- FK para professionals.user_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id, professional_id) -- Garante que um cliente só pode favoritar um profissional uma vez
);

CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    link_destination TEXT,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    title TEXT,
    position banner_position_enum DEFAULT 'home',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    edited_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID, -- FK para professionals.user_id (se a ação for sobre um profissional)
    action_type VARCHAR(255) NOT NULL,
    old_values JSONB, -- Armazena o estado anterior do registro
    new_values JSONB, -- Armazena o novo estado do registro
    edit_reason TEXT,
    performed_by VARCHAR(255) NOT NULL, -- Quem realizou a ação (ex: 'Admin', 'Sistema')
    action_at TIMESTAMPTZ DEFAULT NOW()
);
