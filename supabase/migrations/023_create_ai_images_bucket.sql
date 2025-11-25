-- Migration 023: Create storage bucket for AI-generated images
-- This bucket stores generated food images with multiple size variants
-- Idempotent version

-- Create storage bucket for AI-generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-generated-images',
  'ai-generated-images',
  true, -- Public bucket for serving images
  10485760, -- 10MB limit per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for ai-generated-images bucket
-- We use DO blocks to check if policies exist before creating them to ensure idempotency

-- Allow authenticated users to upload their own images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can upload own AI images'
    ) THEN
        CREATE POLICY "Users can upload own AI images"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'ai-generated-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;

-- Allow authenticated users to update their own images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can update own AI images'
    ) THEN
        CREATE POLICY "Users can update own AI images"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'ai-generated-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;

-- Allow authenticated users to delete their own images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can delete own AI images'
    ) THEN
        CREATE POLICY "Users can delete own AI images"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'ai-generated-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;

-- Allow public read access to all AI-generated images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Public can view AI images'
    ) THEN
        CREATE POLICY "Public can view AI images"
          ON storage.objects FOR SELECT
          TO public
          USING (bucket_id = 'ai-generated-images');
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
