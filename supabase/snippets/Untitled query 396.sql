SELECT
  created_at,
  updated_at,
  rating,
  reason_tags,
  comment,
  user_id,
  studio_image_id,
  dish_id
FROM public.studio_image_feedback
ORDER BY created_at DESC
LIMIT 100;
