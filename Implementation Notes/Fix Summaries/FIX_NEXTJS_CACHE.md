# Fix Next.js Cache Error

## Problem
```
Error: EINVAL: invalid argument, readlink 'C:\Users\Leon Clements\OneDrive\Kiro\.next\server\app-paths-manifest.json'
```

This is a Next.js build cache corruption issue, not related to the database changes.

## Solution

### Option 1: Delete .next folder (Recommended)

Run these commands in PowerShell:

```powershell
# Stop the dev server if running (Ctrl+C)

# Delete the .next folder
Remove-Item -Recurse -Force .next

# Restart the dev server
npm run dev
```

### Option 2: If Option 1 doesn't work

```powershell
# Stop the dev server

# Delete .next and node_modules
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules

# Reinstall dependencies
npm install

# Restart
npm run dev
```

### Option 3: Manual deletion

1. Stop the dev server (Ctrl+C)
2. Open File Explorer
3. Navigate to `C:\Users\Leon Clements\OneDrive\Kiro`
4. Delete the `.next` folder
5. Run `npm run dev` again

## Why This Happens

- Next.js caches build artifacts in the `.next` folder
- Sometimes these files get corrupted (especially on Windows with OneDrive)
- OneDrive sync can interfere with Next.js file operations
- Deleting `.next` forces a clean rebuild

## Prevention

Consider adding `.next` to your OneDrive exclusions if this happens frequently:
1. Right-click the `.next` folder
2. Select "Free up space" or exclude from OneDrive sync

## After the Fix

Once you delete `.next` and restart:
1. Next.js will rebuild everything (takes 10-30 seconds)
2. Your app should start normally
3. The database fix we applied earlier will work correctly
