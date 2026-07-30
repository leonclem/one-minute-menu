# Studio Feedback SQL Reference

These queries retrieve feedback submitted after generating or mutating images in the `/studio` section.

## View Recent Feedback

Run this in the Supabase SQL Editor:

```sql
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
```

This returns the 100 most recent feedback submissions.

## View Feedback for a Specific User

Replace `USER_UUID_HERE` with the user's UUID:

```sql
SELECT *
FROM public.studio_image_feedback
WHERE user_id = 'USER_UUID_HERE'
ORDER BY created_at DESC;
```

## Notes

- Feedback is stored in `public.studio_image_feedback`.
- A user can have one feedback record per generated image. Submitting feedback again updates the existing record.
- Feedback includes the rating, reason tags, optional comment, user/image/dish IDs, and timestamps.
- The table does not store image bytes, prompts, or extracted menu JSON.
- Use an admin or service-role database connection to view feedback for all users. Row-level security restricts normal authenticated users to their own feedback.
- The application also exposes an admin-only endpoint: `GET /api/admin/studio/feedback?limit=100`.
