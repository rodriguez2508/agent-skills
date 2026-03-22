-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for message roles
DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for session status
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Note: TypeORM will create tables automatically with synchronize: true
-- This file is for manual extensions and initial data if needed

-- Insert default admin user (optional)
-- INSERT INTO users (id, email, name, active, total_sessions, total_searches, "createdAt", "updatedAt")
-- VALUES ('00000000-0000-0000-0000-000000000001', 'admin@localhost', 'Admin User', true, 0, 0, NOW(), NOW())
-- ON CONFLICT (email) DO NOTHING;
