-- Allow public read access to published menu versions via parent menu status
ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published menu versions" ON menu_versions;
CREATE POLICY "Public can read published menu versions" ON menu_versions
  FOR SELECT
  USING ((SELECT status FROM menus WHERE id = menu_versions.menu_id) = 'published');


