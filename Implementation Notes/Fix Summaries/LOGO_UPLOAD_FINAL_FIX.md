# Logo Upload - Final Fixes Applied

## Issue 1: Modal Positioning ✅ FIXED

**Problem:** Logo upload modal appeared below viewport, requiring scrolling down to see it.

**Root Cause:** The modal was rendered inline within the component tree (inside `<section>` within `<main>`), inheriting parent positioning. The BatchAIImageGeneration modal worked correctly because it uses `createPortal` to render directly into `document.body`.

**Solution Applied:**
1. Added `createPortal` import from `react-dom`
2. Added `mounted` state with useEffect for client-side detection
3. Wrapped logo modal with `createPortal(..., document.body)`
4. Changed z-index from `z-40` to `z-50` to match batch modal

**Files Modified:**
- `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

**Result:** Modal now appears perfectly centered in viewport, exactly like "Batch Create Photos" modal.

---

## Issue 2: Database Schema Missing Column ✅ FIXED

**Problem:** Upload failed with error:
```
DatabaseError: Failed to update menu logo: Could not find the 'logo_url' column of 'menus' in the schema cache
```

**Root Cause:** The `logo_url` column was never added to the `menus` table in the database.

**Solution Applied:**
1. Created migration file: `add_logo_url_column.sql`
2. Ran migration via Docker:
   ```bash
   Get-Content add_logo_url_column.sql | docker exec -i supabase_db_qr-menu-system psql -U postgres -d postgres
   ```
3. Verified column exists with `\d menus`

**Migration SQL:**
```sql
ALTER TABLE menus 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN menus.logo_url IS 'URL to the restaurant/venue logo image stored in Supabase Storage';
```

**Result:** Database now has `logo_url` column and can store logo URLs.

---

## Testing Checklist

- [x] Modal appears centered in viewport
- [x] Modal uses createPortal (renders to document.body)
- [x] Database has logo_url column
- [ ] Logo upload succeeds (PNG/JPEG)
- [ ] Logo URL is saved to database
- [ ] Logo appears in circular preview after upload
- [ ] Logo displays in template previews
- [ ] Logo exports correctly in PDF/HTML

---

## Next Steps

1. **Test the upload again** - Try uploading your PNG logo
2. **Verify storage** - Check that the logo is uploaded to Supabase Storage
3. **Check database** - Verify the logo_url is saved in the menus table
4. **Test templates** - Navigate to template selection and verify logo appears
5. **Test export** - Export a template and verify logo is included

---

## If Upload Still Fails

Check these potential issues:

1. **Storage bucket exists:**
   ```sql
   SELECT * FROM storage.buckets WHERE name = 'menu-images';
   ```

2. **Storage policies allow upload:**
   ```sql
   SELECT * FROM storage.policies WHERE bucket_id = 'menu-images';
   ```

3. **Check browser console** for any client-side errors

4. **Check server logs** for detailed error messages

5. **Verify file size** - Must be under 8MB

6. **Verify file type** - Must be JPEG or PNG

---

## Files Created/Modified

### Created:
- `add_logo_url_column.sql` - Database migration
- `LOGO_UPLOAD_FINAL_FIX.md` - This document

### Modified:
- `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx` - Added createPortal for modal

### Previous Changes (from earlier fixes):
- Button layout reorganization (4-button grid)
- Icon consistency (ImageUp icon added)
- ImageUpload component (noWrapper prop)

---

## Rollback Instructions

If needed, remove the column:
```sql
ALTER TABLE menus DROP COLUMN IF EXISTS logo_url;
```

To revert code changes:
```bash
git log --oneline -10
git revert <commit-hash>
```
