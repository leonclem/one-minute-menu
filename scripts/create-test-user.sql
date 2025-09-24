-- Create a test user for local development
-- Run this in Supabase Studio SQL Editor

-- Insert user into auth.users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
);

-- Create corresponding profile
INSERT INTO profiles (
  id,
  email,
  plan,
  plan_limits,
  created_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  'test@example.com',
  'free',
  '{"menus": 1, "menuItems": 20, "ocrJobs": 5, "monthlyUploads": 10}',
  NOW()
);