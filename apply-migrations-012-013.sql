-- ============================================================================
-- Combined Migrations: 012 (User Roles) + 013 (Template System)
-- Run this in Supabase Studio SQL Editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 012: Add user roles for admin access control
-- ============================================================================

-- Add role column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Comment for documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin (for dashboard access)';

-- ============================================================================
-- MIGRATION 013: Template System
-- ============================================================================

-- Menu Templates Table
CREATE TABLE IF NOT EXISTS menu_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  version TEXT NOT NULL,
  figma_file_key TEXT NOT NULL,
  preview_image_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  page_format TEXT NOT NULL CHECK (page_format IN ('A4', 'US_LETTER', 'TABLOID', 'DIGITAL')),
  orientation TEXT NOT NULL CHECK (orientation IN ('portrait', 'landscape')),
  tags TEXT[] DEFAULT '{}',
  is_premium BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for menu_templates
CREATE INDEX IF NOT EXISTS idx_menu_templates_tags ON menu_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_menu_templates_active ON menu_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_menu_templates_format ON menu_templates(page_format, orientation);

-- Template Renders Table
CREATE TABLE IF NOT EXISTS template_renders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES menu_templates(id) ON DELETE CASCADE,
  render_data JSONB NOT NULL,
  customization JSONB,
  format TEXT NOT NULL CHECK (format IN ('html', 'pdf', 'png')),
  output_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for template_renders
CREATE INDEX IF NOT EXISTS idx_template_renders_user ON template_renders(user_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_menu ON template_renders(menu_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_template ON template_renders(template_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_status ON template_renders(status);
CREATE INDEX IF NOT EXISTS idx_template_renders_created ON template_renders(created_at DESC);

-- User Template Preferences Table
CREATE TABLE IF NOT EXISTS user_template_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES menu_templates(id) ON DELETE CASCADE,
  customization JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, menu_id)
);

-- Indexes for user_template_preferences
CREATE INDEX IF NOT EXISTS idx_user_template_prefs_user_menu ON user_template_preferences(user_id, menu_id);
CREATE INDEX IF NOT EXISTS idx_user_template_prefs_template ON user_template_preferences(template_id);

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates-compiled',
  'templates-compiled',
  false,
  104857600,
  ARRAY['application/json', 'text/css', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rendered-menus',
  'rendered-menus',
  false,
  104857600,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'text/html']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE menu_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_template_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: menu_templates
CREATE POLICY "Templates are publicly readable"
  ON menu_templates FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can insert templates"
  ON menu_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates"
  ON menu_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete templates"
  ON menu_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies: template_renders
CREATE POLICY "Users can view their own renders"
  ON template_renders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create renders for their own menus"
  ON template_renders FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = template_renders.menu_id
      AND menus.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own renders"
  ON template_renders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own renders"
  ON template_renders FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all renders"
  ON template_renders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies: user_template_preferences
CREATE POLICY "Users can view their own preferences"
  ON user_template_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create preferences for their own menus"
  ON user_template_preferences FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM menus
      WHERE menus.id = user_template_preferences.menu_id
      AND menus.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own preferences"
  ON user_template_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences"
  ON user_template_preferences FOR DELETE
  USING (user_id = auth.uid());

-- Storage RLS Policies
CREATE POLICY "Templates are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'templates');

CREATE POLICY "Admins can upload templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete templates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read compiled templates"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'templates-compiled' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can upload compiled templates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'templates-compiled' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can read their own renders"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rendered-menus' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own renders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rendered-menus' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own renders"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rendered-menus' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_menu_templates_updated_at
  BEFORE UPDATE ON menu_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_template_preferences_updated_at
  BEFORE UPDATE ON user_template_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE menu_templates IS 'Stores metadata and configuration for Figma menu templates';
COMMENT ON TABLE template_renders IS 'Stores render history and results for user menu renders';
COMMENT ON TABLE user_template_preferences IS 'Stores user preferred template and customization settings per menu';
COMMENT ON COLUMN menu_templates.config IS 'JSONB containing TemplateConfig with bindings, styling, and customization options';
COMMENT ON COLUMN template_renders.render_data IS 'JSONB containing RenderResult with HTML, CSS, and metadata';
COMMENT ON COLUMN template_renders.customization IS 'JSONB containing UserCustomization with colors and fonts';
COMMENT ON COLUMN user_template_preferences.customization IS 'JSONB containing UserCustomization with colors and fonts';
