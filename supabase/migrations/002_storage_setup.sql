-- Storage setup for menu images
-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true, -- Public bucket in dev; tighten with signed URLs later if needed
  8388608, -- 8MB limit (8 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
);

-- Storage policies for menu images
CREATE POLICY "Users can upload their own menu images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read access so <img> can fetch without auth in dev
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

-- Add image_url column to menus table for storing uploaded images
ALTER TABLE menus ADD COLUMN image_url TEXT;

-- Add index for image_url queries
CREATE INDEX idx_menus_image_url ON menus(image_url) WHERE image_url IS NOT NULL;

-- Comments
COMMENT ON COLUMN menus.image_url IS 'URL to uploaded menu image in Supabase Storage';