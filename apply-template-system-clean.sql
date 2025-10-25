-- Clean Template System Migration
-- This creates only the essential tables without complex policies that might conflict

-- ============================================================================
-- TABLES
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

CREATE INDEX IF NOT EXISTS idx_template_renders_user ON template_renders(user_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_menu ON template_renders(menu_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_template ON template_renders(template_id);
CREATE INDEX IF NOT EXISTS idx_template_renders_status ON template_renders(status);

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

CREATE INDEX IF NOT EXISTS idx_user_template_prefs_user_menu ON user_template_preferences(user_id, menu_id);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

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

-- ============================================================================
-- RLS POLICIES (Simple versions)
-- ============================================================================

ALTER TABLE menu_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_template_preferences ENABLE ROW LEVEL SECURITY;

-- Public can read active templates
DROP POLICY IF EXISTS "Public can read templates" ON menu_templates;
CREATE POLICY "Public can read templates" ON menu_templates 
  FOR SELECT USING (is_active = TRUE);

-- Users can manage their own renders
DROP POLICY IF EXISTS "Users manage own renders" ON template_renders;
CREATE POLICY "Users manage own renders" ON template_renders 
  FOR ALL USING (user_id = auth.uid());

-- Users can manage their own preferences
DROP POLICY IF EXISTS "Users manage own preferences" ON user_template_preferences;
CREATE POLICY "Users manage own preferences" ON user_template_preferences 
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_menu_templates_updated_at
  BEFORE UPDATE ON menu_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_template_preferences_updated_at
  BEFORE UPDATE ON user_template_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Template system installed successfully!' as status;

SELECT 
  'Tables created: ' || COUNT(*) as info
FROM information_schema.tables 
WHERE table_name IN ('menu_templates', 'template_renders', 'user_template_preferences');

SELECT 
  'Storage buckets created: ' || COUNT(*) as info
FROM storage.buckets 
WHERE id IN ('templates', 'templates-compiled', 'rendered-menus');
