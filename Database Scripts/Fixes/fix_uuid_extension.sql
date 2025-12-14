-- Fix UUID extension issue
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test that the function works
SELECT uuid_generate_v4();