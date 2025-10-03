-- Step 1: Fix UUID extension (run this first)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Test UUID function works
SELECT uuid_generate_v4() as test_uuid;

-- Step 3: Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  8388608, -- 8MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Step 4: Create storage policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can upload their own menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own menu images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own menu images" ON storage.objects;

  -- Create new policies
  CREATE POLICY "Users can upload their own menu images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'menu-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

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
END $$;

-- Step 5: Add image_url column to menus table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'menus' AND column_name = 'image_url') THEN
        ALTER TABLE menus ADD COLUMN image_url TEXT;
        CREATE INDEX IF NOT EXISTS idx_menus_image_url ON menus(image_url) WHERE image_url IS NOT NULL;
        COMMENT ON COLUMN menus.image_url IS 'URL to uploaded menu image in Supabase Storage';
    END IF;
END $$;

-- Step 6: Create uploads table for tracking (if it doesn't exist)
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Create RLS policies for uploads table
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own uploads" ON uploads;
DROP POLICY IF EXISTS "Users can view own uploads" ON uploads;

CREATE POLICY "Users can insert own uploads" ON uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads" ON uploads
  FOR SELECT USING (auth.uid() = user_id);

-- Verify everything was created
SELECT 'Storage bucket created' as status 
WHERE EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'menu-images');

SELECT 'Menus table has image_url column' as status
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'menus' AND column_name = 'image_url');

SELECT 'Uploads table exists' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_name = 'uploads');