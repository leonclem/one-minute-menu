# Menu Extraction Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with AI menu extraction. Most problems can be solved by retaking the photo or making simple adjustments.

## Common Issues and Solutions

### 1. "Image quality too low for reliable extraction"

**Symptoms:**
- Extraction fails completely
- System suggests retaking photo
- Confidence score below 30%

**Causes:**
- Poor lighting (too dark)
- Blurry or out-of-focus image
- Menu text too small in frame
- Low camera resolution

**Solutions:**

1. **Improve Lighting**
   - Move to brighter location
   - Use natural daylight near window
   - Turn on additional lights
   - Avoid shadows on menu

2. **Reduce Blur**
   - Hold camera steady (use both hands)
   - Rest phone on stable surface
   - Use camera timer to avoid shake
   - Clean camera lens

3. **Get Closer**
   - Fill frame with menu
   - Ensure text is large enough to read
   - Use main camera (not front camera)
   - Avoid zooming (move closer instead)

4. **Check Camera Settings**
   - Use highest resolution setting
   - Disable digital zoom
   - Turn off filters or effects
   - Use standard photo mode

**Prevention:**
- Follow [Menu Photo Best Practices](./MENU_PHOTO_BEST_PRACTICES.md)
- Test with a small section first
- Review photo before uploading

---

### 2. "Extraction completed with low confidence"

**Symptoms:**
- Many items flagged for review
- Confidence scores between 30-60%
- Some prices or names incorrect

**Causes:**
- Glare or reflections on menu
- Uneven lighting
- Menu at an angle
- Decorative fonts hard to read

**Solutions:**

1. **Eliminate Glare**
   - Adjust angle to avoid reflections
   - Turn off camera flash
   - Move away from direct light sources
   - Tilt menu slightly if needed

2. **Improve Lighting Consistency**
   - Ensure even lighting across entire menu
   - Avoid half-bright, half-dark photos
   - Use diffused light (not harsh direct light)

3. **Straighten Menu**
   - Photograph menu flat on table
   - Hold camera perpendicular to menu
   - Avoid angled or perspective shots

4. **Handle Decorative Fonts**
   - Ensure fonts are clearly visible
   - Consider photographing sections separately
   - Manually correct items with unusual fonts

**Prevention:**
- Check photo for glare before uploading
- Use matte menus when possible
- Photograph in consistent lighting

---

### 3. Items Missing or Incorrect

**Symptoms:**
- Some menu items not extracted
- Prices wrong or missing
- Items in wrong categories

**Causes:**
- Text obscured or cut off in photo
- Multi-column layout confused
- Decorative elements mistaken for items
- Category headers unclear

**Solutions:**

1. **Ensure Complete Coverage**
   - Verify all items visible in photo
   - Check edges and corners
   - Photograph sections separately if needed
   - Overlap sections slightly

2. **Clarify Layout**
   - For multi-column menus, ensure clear separation
   - Include category headers in frame
   - Avoid cutting off item names or prices
   - Keep reading order clear (left to right, top to bottom)

3. **Review Uncertain Items**
   - Check "Uncertain Items" panel
   - Add missing items manually
   - Correct misidentified items
   - Provide feedback on errors

4. **Manual Corrections**
   - Use inline editing to fix incorrect items
   - Drag items to correct categories
   - Add missing items using "Add Item" button

**Prevention:**
- Include full menu in frame
- Ensure category headers are visible
- Check photo completeness before uploading

---

### 4. Categories Wrong or Missing

**Symptoms:**
- Items not organized into categories
- All items in "Main Menu" category
- Category hierarchy incorrect

**Causes:**
- Category headers not visible in photo
- Headers look like regular text
- Complex nested structure
- Ambiguous category names

**Solutions:**

1. **Include Category Headers**
   - Ensure headers are in frame
   - Verify headers are clearly visible
   - Check that headers stand out from items

2. **Clarify Hierarchy**
   - For nested categories, ensure visual hierarchy is clear
   - Include subcategory headers
   - Photograph sections with clear category boundaries

3. **Manual Organization**
   - Use drag-and-drop to move items
   - Create categories manually if needed
   - Rename categories for clarity
   - Merge or split categories as needed

**Prevention:**
- Photograph full menu with all headers
- Ensure headers are prominent in photo
- Review category structure before publishing

---

### 5. Prices Incorrect or Missing

**Symptoms:**
- Prices extracted incorrectly
- Some items missing prices
- Currency wrong

**Causes:**
- Prices obscured by glare
- Decorative price formatting
- Price ranges unclear
- Currency symbol ambiguous

**Solutions:**

1. **Improve Price Visibility**
   - Eliminate glare on price area
   - Ensure prices are in focus
   - Check that prices aren't cut off

2. **Handle Price Ranges**
   - System should extract both min and max
   - Manually correct if range unclear
   - Consider creating variants for different prices

3. **Verify Currency**
   - System auto-detects from symbols ($, S$, RM, ¥)
   - Manually set currency if incorrect
   - Check account location settings

4. **Manual Price Correction**
   - Edit prices inline in review interface
   - Add missing prices manually
   - Verify all prices before publishing

**Prevention:**
- Ensure prices clearly visible in photo
- Include currency symbols in frame
- Check price accuracy during review

---

### 6. Variants Not Detected (Stage 2)

**Symptoms:**
- Multiple sizes shown as separate items
- Size/price variations not grouped
- Duplicate items created

**Causes:**
- Variant format not recognized
- Sizes and prices not clearly associated
- Complex variant structure

**Solutions:**

1. **Review Variant Detection**
   - Check if variants were extracted
   - Look for items with multiple sizes
   - Verify variant prices are correct

2. **Manual Variant Creation**
   - Use Variant Editor to add variants
   - Merge duplicate items into variants
   - Set size names and prices

3. **Improve Photo Clarity**
   - Ensure size/price associations are clear
   - Photograph variant sections clearly
   - Include all variant information

**Prevention:**
- Ensure variant formatting is clear in photo
- Use Stage 2 extraction for variant support
- Review variants during extraction review

---

### 7. Modifiers Not Detected (Stage 2)

**Symptoms:**
- Sauce options not extracted
- Add-ons missing
- Modifier prices incorrect

**Causes:**
- Modifier section not clearly labeled
- Price deltas unclear
- Modifiers mixed with regular items

**Solutions:**

1. **Review Modifier Detection**
   - Check "Uncertain Items" for modifiers
   - Look for modifier groups in extraction
   - Verify modifier prices

2. **Manual Modifier Creation**
   - Use Modifier Group Editor
   - Add modifier groups manually
   - Set price deltas for options
   - Mark as required/optional

3. **Clarify Modifier Sections**
   - Ensure modifier sections are clearly labeled
   - Include price information for add-ons
   - Photograph modifier sections clearly

**Prevention:**
- Ensure modifier sections are visible
- Use Stage 2 extraction for modifier support
- Review modifiers during extraction review

---

### 8. Extraction Takes Too Long

**Symptoms:**
- Job stuck in "processing" state
- Extraction takes more than 2 minutes
- Timeout errors

**Causes:**
- Large image file size
- High-resolution image
- API rate limiting
- Server overload

**Solutions:**

1. **Reduce Image Size**
   - Compress image before uploading
   - Reduce resolution to 2048x2048 max
   - Use JPEG format (not PNG)
   - Keep file size under 8MB

2. **Check Status**
   - Refresh page to check job status
   - Wait up to 3 minutes for completion
   - Check for error messages

3. **Retry if Needed**
   - If timeout occurs, retry extraction
   - Try photographing sections separately
   - Contact support if persistent

**Prevention:**
- Compress images before uploading
- Use recommended resolution (1024-2048px)
- Avoid uploading very large files

---

### 9. Quota Exceeded

**Symptoms:**
- "Quota exceeded" error message
- Cannot submit new extraction
- Extraction disabled

**Causes:**
- Free tier limit reached (5/month)
- Premium tier limit reached (50/month)
- Daily spending cap exceeded

**Solutions:**

1. **Check Quota Status**
   - View remaining extractions in dashboard
   - Check plan limits
   - Review usage history

2. **Upgrade Plan**
   - Upgrade to premium for more extractions
   - Contact sales for enterprise plans
   - Wait for quota reset (monthly)

3. **Use Manual Entry**
   - Fall back to manual menu entry
   - Edit existing menus instead of re-extracting
   - Prioritize most important menus

**Prevention:**
- Monitor extraction usage
- Plan menu updates within quota
- Consider premium plan if needed

---

### 10. Extraction Cost Too High

**Symptoms:**
- Unexpected charges
- Cost per extraction above $0.03
- Monthly bill higher than expected

**Causes:**
- Very large images
- High-resolution photos
- Frequent re-extractions
- Complex menus requiring more tokens

**Solutions:**

1. **Optimize Images**
   - Compress images before uploading
   - Use recommended resolution (1024-2048px)
   - Avoid re-extracting same menu
   - Use manual editing for small changes

2. **Monitor Costs**
   - Check cost dashboard regularly
   - Review per-extraction costs
   - Set spending alerts
   - Track usage patterns

3. **Efficient Workflow**
   - Get photo right first time
   - Review photo before uploading
   - Use manual editing for corrections
   - Avoid unnecessary re-extractions

**Prevention:**
- Follow photo best practices
- Compress images appropriately
- Monitor cost dashboard
- Use manual editing when possible

---

## Error Messages Reference

### "Image format not supported"
- **Cause:** File is not JPEG or PNG
- **Solution:** Convert to JPEG or PNG format

### "Image too large"
- **Cause:** File size exceeds 8MB
- **Solution:** Compress image or reduce resolution

### "Invalid image file"
- **Cause:** File is corrupted or not an image
- **Solution:** Retake photo and try again

### "API rate limit exceeded"
- **Cause:** Too many requests in short time
- **Solution:** Wait 60 seconds and retry

### "Extraction service unavailable"
- **Cause:** Temporary service outage
- **Solution:** Wait and retry in a few minutes

### "Authentication failed"
- **Cause:** Session expired or invalid
- **Solution:** Log out and log back in

### "Insufficient permissions"
- **Cause:** Account doesn't have extraction access
- **Solution:** Check plan status or contact support

---

## Getting Help

### Self-Service Resources

1. **Photo Best Practices**
   - Review [Menu Photo Best Practices](./MENU_PHOTO_BEST_PRACTICES.md)
   - Check examples of good vs poor photos
   - Follow quick checklist

2. **Feature Documentation**
   - Review [Stage 1 vs Stage 2 Differences](./EXTRACTION_STAGE_COMPARISON.md)
   - Check [API Documentation](./EXTRACTION_API.md)
   - Read [Admin Guide](./EXTRACTION_ADMIN_GUIDE.md) (for admins)

3. **Video Tutorials**
   - Watch menu photo tutorial
   - See extraction review walkthrough
   - Learn manual editing tips

### Contact Support

If you've tried the solutions above and still have issues:

1. **Prepare Information**
   - Screenshot of error message
   - Original menu photo
   - Description of issue
   - Steps you've already tried

2. **Submit Support Request**
   - Email: support@example.com
   - Include job ID if available
   - Attach menu photo
   - Describe expected vs actual results

3. **Response Time**
   - Typical response: 24 hours
   - Urgent issues: 4 hours
   - Include "URGENT" in subject if critical

### Provide Feedback

Help us improve extraction quality:

1. **During Review**
   - Mark corrections as "system error" vs "menu unclear"
   - Provide feedback on extraction quality
   - Submit problematic images for analysis

2. **After Publishing**
   - Rate extraction quality
   - Suggest improvements
   - Report recurring issues

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Blurry image | Hold camera steady, use timer |
| Glare on menu | Adjust angle, turn off flash |
| Items missing | Ensure full menu in frame |
| Wrong categories | Include category headers |
| Prices incorrect | Eliminate glare on prices |
| Takes too long | Compress image, reduce size |
| Quota exceeded | Upgrade plan or wait for reset |
| Low confidence | Improve lighting, retake photo |

---

## Prevention Checklist

Before uploading menu photo:

- [ ] Lighting is bright and even
- [ ] No glare or reflections
- [ ] Menu is flat and straight
- [ ] All text is in focus
- [ ] Full menu in frame
- [ ] File size under 8MB
- [ ] Format is JPEG or PNG
- [ ] Photo reviewed for quality

Following this checklist prevents 90% of extraction issues!
