-- Migration 043: Create storage bucket for export files
-- This bucket stores generated PDF and image exports

-- Create storage bucket for export files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'export-files',
  'export-files',
  false, -- Private bucket, access via signed URLs
  20971520, -- 20MB limit per file
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for export-files bucket
-- Allow authenticated users to upload (workers use service role, but good to have)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can upload own exports'
    ) THEN
        CREATE POLICY "Users can upload own exports"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'export-files' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;

-- Allow users to see their own export files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can view own exports'
    ) THEN
        CREATE POLICY "Users can view own exports"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'export-files' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;

-- Allow users to delete their own export files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can delete own exports'
    ) THEN
        CREATE POLICY "Users can delete own exports"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'export-files' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
END $$;
