-- Add establishment and venue information to menus table
ALTER TABLE menus 
ADD COLUMN establishment_type VARCHAR(50),
ADD COLUMN primary_cuisine VARCHAR(50),
ADD COLUMN venue_info JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN menus.establishment_type IS 'Type of establishment (e.g., fine-dining, casual, cafe, bar)';
COMMENT ON COLUMN menus.primary_cuisine IS 'Primary cuisine of the restaurant (e.g., italian, japanese, mexican)';
COMMENT ON COLUMN menus.venue_info IS 'Contact and location info: address, email, phone, social_media';

