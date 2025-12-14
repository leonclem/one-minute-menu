-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  8388608, -- 8MB limit (8 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for menu images
CREATE POLICY "Users can upload their own menu images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read access so <img> can fetch without auth
CREATE POLICY "Public can view menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

CREATE POLICY "Users can update their own menu images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own menu images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add image_url column to menus table for storing uploaded images (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'menus' AND column_name = 'image_url') THEN
        ALTER TABLE menus ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Add index for image_url queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_menus_image_url ON menus(image_url) WHERE image_url IS NOT NULL;