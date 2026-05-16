-- Allow WebP uploads in the menu-images bucket.
-- The worker already generates and stores WebP variants; this migration
-- aligns the bucket's allowed_mime_types with actual usage.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'menu-images';
