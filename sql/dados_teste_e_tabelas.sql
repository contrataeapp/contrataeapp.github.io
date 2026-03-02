-- ============================================
-- SCRIPT: Dados de Teste + Tabelas Adicionais
-- MVP Contrataê v2.0
-- ============================================

-- 1. CRIAR TABELAS ADICIONAIS SE NÃO EXISTIREM

CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, professional_id)
);

CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    budget_estimate NUMERIC(10, 2),
    available_date DATE,
    image_url TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(reviewer_id, professional_id, created_at::date)
);

CREATE TABLE IF NOT EXISTS client_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status TEXT DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(reviewer_id, client_id, created_at::date)
);

CREATE TABLE IF NOT EXISTS professional_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    service_request_id UUID REFERENCES service_requests(id),
    amount NUMERIC(10, 2),
    type TEXT, -- 'income', 'expense'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. ATUALIZAR CATEGORIAS COM MAIS OPÇÕES

INSERT INTO categories (name, slug, icon_url, generic_phrase)
VALUES 
    ('Barbeiro', 'barbeiro', 'fa-cut', 'Precisa de produtos para cabelo e barba?'),
    ('Mecânico', 'mecanico', 'fa-wrench', 'Precisa de peças e ferramentas automotivas?'),
    ('Jardineiro', 'jardineiro', 'fa-leaf', 'Precisa de ferramentas e sementes de jardinagem?'),
    ('Carpinteiro', 'carpinteiro', 'fa-hammer', 'Precisa de madeiras e ferramentas?'),
    ('Eletricista Residencial', 'eletricista-residencial', 'fa-plug', 'Precisa de materiais elétricos?'),
    ('Encanador Residencial', 'encanador-residencial', 'fa-water', 'Precisa de materiais hidráulicos?'),
    ('Outros', 'outros', 'fa-th', 'Descreva o serviço que você precisa')
ON CONFLICT (slug) DO NOTHING;

-- 3. CRIAR USUÁRIOS DE TESTE

-- Cliente de Teste
INSERT INTO users (email, password, full_name, phone_number, user_type, avatar_url)
VALUES (
    'cliente@teste.com',
    '$2b$10$YourHashedPasswordHere', -- Será substituído pelo hash real
    'João Silva',
    '16 99999-0001',
    'client',
    'https://via.placeholder.com/150?text=Cliente'
) ON CONFLICT (email) DO NOTHING;

-- Profissionais de Teste
INSERT INTO users (email, password, full_name, phone_number, user_type, avatar_url)
VALUES 
    (
        'pintor@teste.com',
        '$2b$10$YourHashedPasswordHere',
        'Carlos Pintor',
        '16 99999-0002',
        'professional',
        'https://via.placeholder.com/150?text=Pintor'
    ),
    (
        'eletricista@teste.com',
        '$2b$10$YourHashedPasswordHere',
        'Pedro Eletricista',
        '16 99999-0003',
        'professional',
        'https://via.placeholder.com/150?text=Eletricista'
    ),
    (
        'encanador@teste.com',
        '$2b$10$YourHashedPasswordHere',
        'Roberto Encanador',
        '16 99999-0004',
        'professional',
        'https://via.placeholder.com/150?text=Encanador'
    ),
    (
        'pedreiro@teste.com',
        '$2b$10$YourHashedPasswordHere',
        'Marcos Pedreiro',
        '16 99999-0005',
        'professional',
        'https://via.placeholder.com/150?text=Pedreiro'
    ),
    (
        'barbeiro@teste.com',
        '$2b$10$YourHashedPasswordHere',
        'Anderson Barbeiro',
        '16 99999-0006',
        'professional',
        'https://via.placeholder.com/150?text=Barbeiro'
    )
ON CONFLICT (email) DO NOTHING;

-- 4. CRIAR PERFIS DE PROFISSIONAIS

-- Pintor
INSERT INTO professionals (id, category_id, description, price_info, availability, whatsapp, photo_url, status, rating_avg)
SELECT u.id, c.id, 
    'Pintor profissional com 10 anos de experiência. Trabalho de qualidade em residências e comércios.',
    'A partir de R$ 50/hora',
    'Segunda a Sexta, 8h às 17h',
    '16 99999-0002',
    'https://via.placeholder.com/300?text=Pintor+Trabalho',
    'active',
    4.8
FROM users u, categories c
WHERE u.email = 'pintor@teste.com' AND c.slug = 'pintor'
ON CONFLICT (id) DO NOTHING;

-- Eletricista
INSERT INTO professionals (id, category_id, description, price_info, availability, whatsapp, photo_url, status, rating_avg)
SELECT u.id, c.id,
    'Eletricista licenciado com certificação. Instalações, manutenção e reparos elétricos.',
    'A partir de R$ 80/hora',
    'Segunda a Sábado, 8h às 18h',
    '16 99999-0003',
    'https://via.placeholder.com/300?text=Eletricista+Trabalho',
    'active',
    4.9
FROM users u, categories c
WHERE u.email = 'eletricista@teste.com' AND c.slug = 'eletricista'
ON CONFLICT (id) DO NOTHING;

-- Encanador
INSERT INTO professionals (id, category_id, description, price_info, availability, whatsapp, photo_url, status, rating_avg)
SELECT u.id, c.id,
    'Encanador experiente em instalações hidráulicas, manutenção e reparos de emergência.',
    'A partir de R$ 70/hora',
    'Segunda a Domingo, 7h às 19h',
    '16 99999-0004',
    'https://via.placeholder.com/300?text=Encanador+Trabalho',
    'active',
    4.7
FROM users u, categories c
WHERE u.email = 'encanador@teste.com' AND c.slug = 'encanador'
ON CONFLICT (id) DO NOTHING;

-- Pedreiro
INSERT INTO professionals (id, category_id, description, price_info, availability, whatsapp, photo_url, status, rating_avg)
SELECT u.id, c.id,
    'Pedreiro especializado em alvenaria, reboco e acabamentos. Reformas completas.',
    'Orçamento sob consulta',
    'Segunda a Sexta, 8h às 17h',
    '16 99999-0005',
    'https://via.placeholder.com/300?text=Pedreiro+Trabalho',
    'active',
    4.6
FROM users u, categories c
WHERE u.email = 'pedreiro@teste.com' AND c.slug = 'pedreiro'
ON CONFLICT (id) DO NOTHING;

-- Barbeiro
INSERT INTO professionals (id, category_id, description, price_info, availability, whatsapp, photo_url, status, rating_avg)
SELECT u.id, c.id,
    'Barbeiro profissional com técnicas modernas. Cortes, barbas e tratamentos capilares.',
    'A partir de R$ 40',
    'Terça a Sábado, 9h às 19h',
    '16 99999-0006',
    'https://via.placeholder.com/300?text=Barbeiro+Trabalho',
    'active',
    4.9
FROM users u, categories c
WHERE u.email = 'barbeiro@teste.com' AND c.slug = 'barbeiro'
ON CONFLICT (id) DO NOTHING;

-- 5. ADICIONAR FOTOS DE PORTFÓLIO PARA PROFISSIONAIS

INSERT INTO professional_photos (professional_id, photo_url, caption, order_index)
SELECT p.id, url, caption, idx
FROM (
    SELECT u.id as user_id, array_agg(
        json_build_object(
            'url', 'https://via.placeholder.com/400?text=Trabalho+' || (row_number() OVER ()),
            'caption', 'Trabalho realizado em ' || to_char(now(), 'YYYY'),
            'idx', row_number() OVER ()
        )
    ) as photos
    FROM users u
    WHERE u.user_type = 'professional'
    GROUP BY u.id
) as temp,
professionals p,
jsonb_array_elements(to_jsonb(temp.photos)) as photo_obj,
lateral (
    SELECT 
        (photo_obj->>'url')::text as url,
        (photo_obj->>'caption')::text as caption,
        (photo_obj->>'idx')::int as idx
) as photo_data
WHERE p.id = temp.user_id
ON CONFLICT DO NOTHING;

-- 6. ADICIONAR ALGUMAS AVALIAÇÕES DE TESTE

INSERT INTO professional_ratings (reviewer_id, professional_id, rating, comment, status)
SELECT 
    (SELECT id FROM users WHERE email = 'cliente@teste.com'),
    p.id,
    5,
    'Excelente trabalho! Recomendo muito. Profissional atencioso e pontual.',
    'approved'
FROM professionals p
LIMIT 3
ON CONFLICT DO NOTHING;

-- 7. DESATIVAR RLS (para desenvolvimento)
ALTER TABLE IF EXISTS favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS professional_ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS professional_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;

-- 8. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_professional_id ON favorites(professional_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_professional_id ON service_requests(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_ratings_professional_id ON professional_ratings(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_ratings_reviewer_id ON professional_ratings(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_professional_photos_professional_id ON professional_photos(professional_id);
CREATE INDEX IF NOT EXISTS idx_transactions_professional_id ON transactions(professional_id);
