-- Public read access for published menus
-- Allows anonymous users to SELECT menus where status = 'published'

-- Ensure RLS is enabled (it already is in initial schema)
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

-- Create or replace policy for public reads of published menus
DROP POLICY IF EXISTS "Public can read published menus" ON menus;
CREATE POLICY "Public can read published menus" ON menus
  FOR SELECT
  USING (status = 'published');

-- Optional: narrow to selected columns in future; for MVP we allow full row select


