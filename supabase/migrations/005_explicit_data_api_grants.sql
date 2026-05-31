-- =====================================================
-- EXPLICIT DATA API GRANTS FOR PUBLIC SCHEMA
-- =====================================================
-- Supabase rollout note:
-- New projects (from 2026-05-30) and new tables on existing projects
-- (from 2026-10-30) require explicit grants for Data API access.
--
-- This migration keeps current app behavior unchanged by explicitly granting
-- privileges that were previously available by default.


-- Schema usage is required before table access.
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- Keep current behavior for all existing objects in public schema.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;


GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;


GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO service_role;


-- Ensure new objects created in public schema keep the same access model.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;


ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON ROUTINES TO service_role;