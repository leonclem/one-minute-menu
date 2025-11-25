-- Migration 013: Add menu_template_selections table for template engine
-- Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6

-- Create menu_template_selections table
CREATE TABLE IF NOT EXISTS menu_template_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{"textOnly": false, "useLogo": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one template selection per menu
  CONSTRAINT unique_menu_template_selection UNIQUE(menu_id)
);

-- Create index for efficient menu_id lookups
CREATE INDEX IF NOT EXISTS idx_menu_template_selections_menu_id 
  ON menu_template_selections(menu_id);

-- Create index for template_id lookups (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_menu_template_selections_template_id 
  ON menu_template_selections(template_id);

-- Add comments for documentation
COMMENT ON TABLE menu_template_selections IS 'Stores user template selections for the grid menu template engine';
COMMENT ON COLUMN menu_template_selections.menu_id IS 'Foreign key to menus table';
COMMENT ON COLUMN menu_template_selections.template_id IS 'Template identifier (e.g., classic-grid-cards, two-column-text)';
COMMENT ON COLUMN menu_template_selections.template_version IS 'Template version for compatibility tracking';
COMMENT ON COLUMN menu_template_selections.configuration IS 'Template configuration options (textOnly, colourPaletteId, useLogo)';

-- Enable RLS on menu_template_selections
ALTER TABLE menu_template_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage template selections for their own menus
CREATE POLICY "Users can manage own menu template selections" 
  ON menu_template_selections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM menus 
      WHERE menus.id = menu_template_selections.menu_id 
      AND menus.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menus 
      WHERE menus.id = menu_template_selections.menu_id 
      AND menus.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_menu_template_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_menu_template_selections_updated_at
  BEFORE UPDATE ON menu_template_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_template_selections_updated_at();

-- Note: To manually set a template selection for testing:
-- INSERT INTO menu_template_selections (menu_id, template_id, template_version, configuration)
-- VALUES ('your-menu-uuid', 'classic-grid-cards', '1.0.0', '{"textOnly": false, "useLogo": false}')
-- ON CONFLICT (menu_id) DO UPDATE SET 
--   template_id = EXCLUDED.template_id,
--   template_version = EXCLUDED.template_version,
--   configuration = EXCLUDED.configuration;
