-- Create storage buckets for AI-generated images
-- Run this in your Supabase SQL Editor

-- Create bucket for AI-generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-generated-images',
  'ai-generated-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for menu images (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for ai-generated-images bucket
CREATE POLICY "Users can upload AI images for own menu items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-generated-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view AI images for own menu items"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-generated-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete AI images for own menu items"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-generated-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view AI images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ai-generated-images');

-- Set up RLS policies for menu-images bucket (if not already set)
CREATE POLICY "Users can upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own menu images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'menu-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own menu images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'menu-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view menu images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');

SELECT 'Storage buckets created successfully!' as status;
