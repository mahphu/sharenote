# 🚀 FINAL SETUP - Run This Once

## ⚠️ IMPORTANT: Use the Unified SQL File

**DO NOT run the old SQL files separately!** They will conflict.

Instead, use the new **unified file**: `complete_database_setup.sql`

## Setup Steps

### 1. Run the Unified SQL

1. Open `complete_database_setup.sql`
2. Go to **Supabase Dashboard → SQL Editor**
3. Paste the ENTIRE file
4. Click **Run** (or press F5)
5. Wait for success messages

### 2. Verify Success

You should see these messages at the bottom:
```
✓ Realtime enabled for messages and boards tables
✓ Public access column added to boards
✓ Broadcast authorization policy created
✓ Canvas persistence triggers created
✓ RLS policies updated with sharing support
✓ Setup complete! Refresh your app.
```

### 3. Refresh Your App

- Press F5 in your browser
- All features should now work!

## What This SQL Does

### ✅ Realtime Setup
- Enables Postgres Changes for `messages` and `boards`
- Creates broadcast authorization for cursors
- Sets up auto-save triggers for canvas

### ✅ Share Feature
- Adds `public_access` column to boards
- Updates RLS policies for public sharing
- Supports: restricted, viewer, editor access

### ✅ Combined Policies
- **Boards SELECT**: Owner OR public access
- **Boards UPDATE**: Owner OR editor access
- **Messages SELECT**: Accessible boards only
- **Messages INSERT**: Owner or editor access only

## Features Now Working

✅ Real-time chat (Postgres Changes)  
✅ Canvas persistence (auto-save + F5 safe)  
✅ Live cursors (Broadcast)  
✅ User presence (Presence)  
✅ Share via link (3 access levels)  
✅ Read-only mode for viewers  

## Troubleshooting

### If you already ran the old SQL files:

This unified SQL will fix any conflicts. Just run it and it will:
- Drop conflicting policies
- Recreate them correctly
- Handle existing `public_access` column safely

### If you get errors:

1. Check that you're running in Supabase SQL Editor
2. Make sure you have admin access
3. Copy the error message and check which line failed

---

## Summary

**Single file to run**: `complete_database_setup.sql`  
**Where**: Supabase Dashboard → SQL Editor  
**When**: Once, right now  
**Result**: Everything works! 🎉
