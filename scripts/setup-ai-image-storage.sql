-- Create storage bucket for AI-generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
ON CONFLICT (id) DO NOTHING
VALUES (
  'ai-generated-images',
  'ai-generated-images',
  true, -- Public read access for serving images
  10485760, -- 10MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies for AI-generated images
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can upload AI generated images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view AI generated images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own AI generated images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own AI generated images" ON storage.objects;

  -- Create new policies
  CREATE POLICY "Users can upload AI generated images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'ai-generated-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  -- Public read access so images can be served without auth
  CREATE POLICY "Public can view AI generated images" ON storage.objects
    FOR SELECT USING (bucket_id = 'ai-generated-images');

  CREATE POLICY "Users can update their own AI generated images" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'ai-generated-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Users can delete their own AI generated images" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'ai-generated-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
END $$;

-- Verify bucket was created
SELECT 'AI image storage bucket created' as status 
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ai-generated-images');