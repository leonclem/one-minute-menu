-- Minimal setup for OCR functionality
-- Step 1: Ensure UUID extension works
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create basic tables needed for the app
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
    plan_limits JSONB DEFAULT '{"menus": 1, "items": 20, "ocr_jobs": 5, "monthly_uploads": 10}',
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles 
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create menus table
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    current_version INTEGER DEFAULT 1,
    menu_data JSONB NOT NULL DEFAULT '{}',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, slug)
);

-- Enable RLS on menus
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menus
CREATE POLICY "Users can manage own menus" ON menus 
    USING (auth.uid() = user_id);

-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  8388608, -- 8MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies
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

-- Create uploads table for tracking
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on uploads
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for uploads
CREATE POLICY "Users can insert own uploads" ON uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads" ON uploads
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add some basic indexes
CREATE INDEX IF NOT EXISTS idx_menus_user_id ON menus(user_id);
CREATE INDEX IF NOT EXISTS idx_menus_image_url ON menus(image_url) WHERE image_url IS NOT NULL;

-- Verify setup
SELECT 'Setup complete!' as status;
SELECT 'Storage bucket: ' || id as bucket_status FROM storage.buckets WHERE id = 'menu-images';
SELECT 'Tables created: menus, profiles, uploads' as tables_status;