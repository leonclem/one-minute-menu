-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images', 
  true,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can upload their own menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view their own menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own menu images" ON storage.objects;

  -- Create new policies
  CREATE POLICY "Users can upload their own menu images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'menu-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Users can view their own menu images" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'menu-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

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
END $$;

-- Ensure bucket is public (idempotent)
UPDATE storage.buckets SET public = true WHERE id = 'menu-images';