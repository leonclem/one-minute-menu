# Google Vision API Setup for Production

## Step 1: Get your Google Vision Service Account JSON

1. You should already have this file locally at: `C:\Users\Leon Clements\.secrets\gcp\vision-sa.json`
2. Open this file and copy its entire contents

## Step 2: Add to Vercel Environment Variables

1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to Environment Variables
4. Add a new variable:
   - **Name**: `GOOGLE_CREDENTIALS_JSON`
   - **Value**: Paste the entire JSON content from your service account file
   - **Environment**: Production

## Step 3: Deploy

After adding the environment variable, redeploy your application. The OCR functionality should now work directly in your Next.js API routes without needing the separate Railway worker.

## How it works now

1. ✅ User uploads image → stored in Supabase Storage
2. ✅ User clicks "Extract Items" → calls `/api/menus/[menuId]/ocr`
3. ✅ API route processes image directly using Google Vision API
4. ✅ Results are stored in `ocr_jobs` table and returned immediately
5. ✅ No separate worker needed - everything runs in Vercel

## Testing

After deployment, try:
1. Upload a menu image
2. Click "Extract Items"
3. You should see the extracted text appear immediately (no more "queued" status)