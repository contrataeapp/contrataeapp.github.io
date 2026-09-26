-- Script 04: Criação de Índices

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users (user_type);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);

CREATE INDEX IF NOT EXISTS idx_professionals_category_id ON professionals (category_id);
CREATE INDEX IF NOT EXISTS idx_professionals_status ON professionals (status);

CREATE INDEX IF NOT EXISTS idx_reviews_professional_id ON reviews (professional_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews (client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);

CREATE INDEX IF NOT EXISTS idx_services_professional_id ON services (professional_id);
CREATE INDEX IF NOT EXISTS idx_services_client_id ON services (client_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services (status);

CREATE INDEX IF NOT EXISTS idx_favorites_client_id ON favorites (client_id);
CREATE INDEX IF NOT EXISTS idx_favorites_professional_id ON favorites (professional_id);

CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners (is_active);
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners (position);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);

CREATE INDEX IF NOT EXISTS idx_admin_logs_professional_id ON admin_logs (professional_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs (action_type);
