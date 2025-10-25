-- Rollback template system but KEEP the role column

-- Drop triggers
DROP TRIGGER IF EXISTS update_menu_templates_updated_at ON menu_templates;
DROP TRIGGER IF EXISTS update_user_template_preferences_updated_at ON user_template_preferences;

-- Drop storage policies (these might be causing conflicts)
DROP POLICY IF EXISTS "Templates are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload templates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update templates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read compiled templates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload compiled templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own renders" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own renders" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own renders" ON storage.objects;

-- Drop table policies
DROP POLICY IF EXISTS "Templates are publicly readable" ON menu_templates;
DROP POLICY IF EXISTS "Admins can insert templates" ON menu_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON menu_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON menu_templates;
DROP POLICY IF EXISTS "Users can view their own renders" ON template_renders;
DROP POLICY IF EXISTS "Users can create renders for their own menus" ON template_renders;
DROP POLICY IF EXISTS "Users can update their own renders" ON template_renders;
DROP POLICY IF EXISTS "Users can delete their own renders" ON template_renders;
DROP POLICY IF EXISTS "Admins can view all renders" ON template_renders;
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_template_preferences;
DROP POLICY IF EXISTS "Users can create preferences for their own menus" ON user_template_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_template_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_template_preferences;

-- Drop tables
DROP TABLE IF EXISTS user_template_preferences CASCADE;
DROP TABLE IF EXISTS template_renders CASCADE;
DROP TABLE IF EXISTS menu_templates CASCADE;

-- Drop storage buckets
DELETE FROM storage.buckets WHERE id = 'rendered-menus';
DELETE FROM storage.buckets WHERE id = 'templates-compiled';
DELETE FROM storage.buckets WHERE id = 'templates';

-- Keep the role column and its index
-- Keep the handle_new_user function with role support

SELECT 'Rollback complete. Role column preserved.' as status;
