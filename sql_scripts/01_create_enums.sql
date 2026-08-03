-- Script 01: Criação de Tipos ENUM

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
        CREATE TYPE user_type_enum AS ENUM ('client', 'professional');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'professional_status_enum') THEN
        CREATE TYPE professional_status_enum AS ENUM ('active', 'pending', 'paused', 'excluded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status_enum') THEN
        CREATE TYPE review_status_enum AS ENUM ('visible', 'hidden', 'pending');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_status_enum') THEN
        CREATE TYPE service_status_enum AS ENUM ('pending', 'completed', 'canceled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'banner_position_enum') THEN
        CREATE TYPE banner_position_enum AS ENUM ('home', 'category');
    END IF;
END
$$;
