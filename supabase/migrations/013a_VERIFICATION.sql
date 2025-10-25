-- Verification Script for Migration 013: Template System
-- Run this after applying the migration to verify everything was created correctly

-- ============================================================================
-- VERIFY TABLES EXIST
-- ============================================================================

SELECT 
  'Tables Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('menu_templates', 'template_renders', 'user_template_preferences');

-- ============================================================================
-- VERIFY INDEXES EXIST
-- ============================================================================

SELECT 
  'Indexes Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 10 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('menu_templates', 'template_renders', 'user_template_preferences');

-- ============================================================================
-- VERIFY STORAGE BUCKETS EXIST
-- ============================================================================

SELECT 
  'Storage Buckets Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM storage.buckets 
WHERE id IN ('templates', 'templates-compiled', 'rendered-menus');

-- ============================================================================
-- VERIFY RLS IS ENABLED
-- ============================================================================

SELECT 
  'RLS Enabled' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('menu_templates', 'template_renders', 'user_template_preferences')
AND rowsecurity = true;

-- ============================================================================
-- VERIFY TABLE POLICIES EXIST
-- ============================================================================

SELECT 
  'Table Policies Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 13 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM pg_policies 
WHERE tablename IN ('menu_templates', 'template_renders', 'user_template_preferences');

-- ============================================================================
-- VERIFY STORAGE POLICIES EXIST
-- ============================================================================

SELECT 
  'Storage Policies Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 10 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- ============================================================================
-- VERIFY TRIGGERS EXIST
-- ============================================================================

SELECT 
  'Triggers Created' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 2 THEN '✓ PASS' 
    ELSE '✗ FAIL' 
  END as status
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
AND event_object_table IN ('menu_templates', 'user_template_preferences')
AND trigger_name LIKE '%updated_at%';

-- ============================================================================
-- DETAILED TABLE INFORMATION
-- ============================================================================

-- Show all columns for menu_templates
SELECT 
  'menu_templates columns' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'menu_templates'
ORDER BY ordinal_position;

-- Show all columns for template_renders
SELECT 
  'template_renders columns' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'template_renders'
ORDER BY ordinal_position;

-- Show all columns for user_template_preferences
SELECT 
  'user_template_preferences columns' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_template_preferences'
ORDER BY ordinal_position;

-- ============================================================================
-- STORAGE BUCKET DETAILS
-- ============================================================================

SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id IN ('templates', 'templates-compiled', 'rendered-menus')
ORDER BY id;

-- ============================================================================
-- POLICY DETAILS
-- ============================================================================

-- Table policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('menu_templates', 'template_renders', 'user_template_preferences')
ORDER BY tablename, policyname;

-- Storage policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%template%' OR policyname LIKE '%render%'
ORDER BY policyname;
