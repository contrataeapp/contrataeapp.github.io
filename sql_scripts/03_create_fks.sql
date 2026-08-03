-- Script 03: Criação de Chaves Estrangeiras (Foreign Keys)

ALTER TABLE professionals
ADD CONSTRAINT fk_professionals_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE professionals
ADD CONSTRAINT fk_professionals_category_id
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

ALTER TABLE reviews
ADD CONSTRAINT fk_reviews_professional_id
FOREIGN KEY (professional_id) REFERENCES professionals(user_id) ON DELETE CASCADE;

ALTER TABLE reviews
ADD CONSTRAINT fk_reviews_client_id
FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE services
ADD CONSTRAINT fk_services_professional_id
FOREIGN KEY (professional_id) REFERENCES professionals(user_id) ON DELETE CASCADE;

ALTER TABLE services
ADD CONSTRAINT fk_services_client_id
FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE favorites
ADD CONSTRAINT fk_favorites_client_id
FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE favorites
ADD CONSTRAINT fk_favorites_professional_id
FOREIGN KEY (professional_id) REFERENCES professionals(user_id) ON DELETE CASCADE;

ALTER TABLE admin_logs
ADD CONSTRAINT fk_admin_logs_professional_id
FOREIGN KEY (professional_id) REFERENCES professionals(user_id) ON DELETE SET NULL;
