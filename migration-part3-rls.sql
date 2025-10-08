-- AI Image Generation Feature Schema - Part 3: Row Level Security
-- Run this after Part 2

-- Row Level Security (RLS) policies
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage menu items for own menus" ON menu_items 
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE user_id = auth.uid()
    )
  );

ALTER TABLE ai_generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generated images" ON ai_generated_images 
  FOR SELECT USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generated images for own items" ON ai_generated_images 
  FOR INSERT WITH CHECK (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own generated images" ON ai_generated_images 
  FOR UPDATE USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own generated images" ON ai_generated_images 
  FOR DELETE USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m on mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

ALTER TABLE image_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generation jobs" ON image_generation_jobs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation jobs" ON image_generation_jobs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generation jobs" ON image_generation_jobs 
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE generation_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quota" ON generation_quotas 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quota" ON generation_quotas 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON generation_quotas 
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE generation_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analytics" ON generation_analytics 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" ON generation_analytics 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics" ON generation_analytics 
  FOR UPDATE USING (auth.uid() = user_id);