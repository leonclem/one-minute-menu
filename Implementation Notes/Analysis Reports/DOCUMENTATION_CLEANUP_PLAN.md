# Documentation Cleanup Plan

## Overview

This plan provides step-by-step instructions for cleaning up outdated documentation and code based on the audit findings.

## Phase 1: Immediate Cleanup (High Priority)

### 1.1 Remove Unused Google Vision API Code

**Files to Delete:**
```bash
# Delete unused Vision API implementation
rm src/lib/vision.ts

# Remove from package.json dependencies
npm uninstall @google-cloud/vision
```

**Verification:**
```bash
# Confirm no imports remain
grep -r "from.*vision\|import.*vision" src/
# Should return no results (except in _workers which will be deleted)
```

### 1.2 Remove Deprecated OCR Worker

**Directory to Delete:**
```bash
# Remove entire Python OCR worker
rm -rf _workers/ocr/
```

**Files that reference this (safe to delete):**
- `_workers/ocr/README.md`
- `_workers/ocr/src/`
- `_workers/ocr/tests/`
- `_workers/ocr/requirements.txt`

### 1.3 Update Architecture Document

**File:** `SYSTEM_ARCHITECTURE.md`

**Changes needed:**

1. **Remove Google Vision API references:**
   ```diff
   - **AI/ML Services**
   -   VISION[Google Vision API]
   -   OPENAI[OpenAI GPT-4]
   +   OPENAI[OpenAI GPT-4V Vision]
   ```

2. **Correct AI processing description:**
   ```diff
   - **Two-Stage Processing:**
   - 1. **Stage 1:** Basic OCR + GPT parsing
   - 2. **Stage 2:** Advanced parsing with variants/modifiers
   + **Single-Stage Vision-LLM Processing:**
   + - Direct image-to-structured-data using OpenAI GPT-4V
   + - Two schema versions (stage1: basic, stage2: advanced)
   ```

3. **Move unimplemented features to "Future Features" section:**
   ```diff
   - **Current Features:**
   - - Theme customization
   - - Payment integration
   + **Future Features:**
   + - Theme customization UI
   + - Advanced payment processing
   ```

## Phase 2: Test File Updates (Medium Priority)

### 2.1 Update Test Files with OCR References

**Files to update:**

1. **`src/__tests__/performance/menu-loading.test.ts`**
   ```diff
   - // OCR processing targets
   - expect(ocrTime).toBeLessThan(20000)
   + // Extraction processing targets  
   + expect(extractionTime).toBeLessThan(20000)
   ```

2. **`src/__tests__/integration/external-apis.test.ts`**
   ```diff
   - describe('Google Vision API', () => {
   -   // Remove entire test suite
   - })
   + // Keep OpenAI and other current API tests
   ```

3. **`src/__tests__/e2e/critical-journeys.test.ts`**
   ```diff
   - const ocrResponse = await fetch('/api/menus/123/ocr')
   + const extractionResponse = await fetch('/api/extraction/submit')
   ```

### 2.2 Update Middleware Tests

**File:** `src/__tests__/middleware.test.ts`

Already updated correctly to use `/api/extraction/submit` - no changes needed.

## Phase 3: Archive Historical Documentation (Low Priority)

### 3.1 Create Archive Directory

```bash
mkdir -p docs/archive/ocr-legacy/
```

### 3.2 Move Historical Files

**Files to archive (not delete):**
```bash
# Move OCR-related documentation to archive
mv docs/OCR_DEPRECATION_GUIDE.md docs/archive/ocr-legacy/
mv docs/OCR_REMOVAL_COMPLETE.md docs/archive/ocr-legacy/

# Move historical migration files
mkdir -p docs/archive/migrations/
mv supabase/migrations/003_ocr_notify.sql docs/archive/migrations/
mv add_ocr_tables.sql docs/archive/migrations/ # if it exists
```

### 3.3 Create Archive Index

**File:** `docs/archive/README.md`
```markdown
# Archived Documentation

This directory contains historical documentation that is no longer relevant to the current system but is preserved for reference.

## OCR Legacy (docs/archive/ocr-legacy/)
- Documentation from the original OCR-based extraction system
- Replaced by vision-LLM extraction in January 2025

## Migrations (docs/archive/migrations/)  
- Historical database migrations that are no longer needed
- Kept for understanding system evolution

## Access
These files are read-only and should not be modified.
For current documentation, see the main docs/ directory.
```

## Phase 4: Validation and Testing

### 4.1 Verify Cleanup

**Run these commands to verify cleanup:**

```bash
# 1. Confirm no Google Vision imports
grep -r "@google-cloud/vision\|from.*vision\|import.*vision" src/
# Should return no results

# 2. Confirm extraction API is working
npm test -- src/app/api/extraction/__tests__/

# 3. Confirm no broken imports
npm run build
# Should complete without errors

# 4. Confirm OCR references are gone
grep -r "ocr\|OCR" src/ --exclude-dir=__tests__ --exclude="*.md"
# Should only return legitimate references (like "micro", not OCR)
```

### 4.2 Update Package.json Scripts

**Remove any OCR-related scripts:**
```diff
- "ocr:worker": "python _workers/ocr/src/main.py",
- "ocr:test": "python -m pytest _workers/ocr/tests/",
```

### 4.3 Test Critical Paths

**Manual testing checklist:**
- [ ] Menu creation works
- [ ] Image upload and extraction works via `/api/extraction/submit`
- [ ] Extraction status polling works via `/api/extraction/status/:jobId`
- [ ] Menu publishing works
- [ ] Public menu viewing works
- [ ] Admin dashboard works

## Phase 5: Documentation Updates

### 5.1 Update README.md

**File:** `README.md`

```diff
- **OCR**: Google Vision API + OpenAI for parsing
+ **AI Extraction**: OpenAI GPT-4V for direct image-to-menu parsing
```

```diff
- **Railway**: Python OCR worker hosting
+ **AI Services**: OpenAI for extraction and image generation
```

### 5.2 Update API Documentation

**File:** `docs/EXTRACTION_API.md`

Confirm it accurately reflects current implementation (it appears to be current).

### 5.3 Create Migration Guide

**File:** `docs/MIGRATION_FROM_OCR.md`
```markdown
# Migration from OCR to Vision-LLM

## Overview
In January 2025, the system migrated from a two-stage OCR approach to a single-stage vision-LLM approach.

## What Changed
- **Old:** Google Vision OCR → OpenAI parsing
- **New:** OpenAI GPT-4V direct extraction

## API Changes
- **Old:** `POST /api/menus/:id/ocr`
- **New:** `POST /api/extraction/submit`

## Benefits
- 90%+ accuracy (vs 70% with OCR)
- Single API call (vs two-stage)
- Better handling of complex layouts
- Lower maintenance overhead

## For Developers
If you see references to OCR in old code:
1. Replace with extraction service calls
2. Update test expectations
3. Remove Google Vision dependencies
```

## Execution Timeline

### Week 1: High Priority Items
- [ ] Day 1: Remove `src/lib/vision.ts`
- [ ] Day 1: Remove `_workers/ocr/` directory  
- [ ] Day 2: Remove `@google-cloud/vision` dependency
- [ ] Day 3: Update `SYSTEM_ARCHITECTURE.md`
- [ ] Day 4: Test and verify changes
- [ ] Day 5: Update README.md

### Week 2: Medium Priority Items
- [ ] Day 1-3: Update test files
- [ ] Day 4: Archive historical documentation
- [ ] Day 5: Create migration guide

### Week 3: Validation and Polish
- [ ] Day 1-2: Comprehensive testing
- [ ] Day 3: Documentation review
- [ ] Day 4: Team review and feedback
- [ ] Day 5: Final cleanup and commit

## Risk Mitigation

### Backup Strategy
Before making changes:
```bash
# Create backup branch
git checkout -b backup/pre-cleanup
git push origin backup/pre-cleanup

# Create cleanup branch
git checkout -b cleanup/remove-ocr-legacy
```

### Rollback Plan
If issues arise:
```bash
# Rollback to backup
git checkout main
git reset --hard backup/pre-cleanup
```

### Testing Strategy
- Run full test suite after each phase
- Manual testing of critical user journeys
- Verify no broken imports or missing dependencies

## Success Criteria

### Technical
- [ ] No Google Vision API references in code
- [ ] All tests pass
- [ ] Application builds and runs correctly
- [ ] No broken imports or dependencies

### Documentation
- [ ] Architecture document is accurate
- [ ] API documentation reflects current implementation
- [ ] Historical documentation is properly archived
- [ ] Migration guide exists for future reference

### User Experience
- [ ] All user-facing features work correctly
- [ ] No performance regressions
- [ ] Error messages are appropriate
- [ ] Admin dashboard functions properly

## Post-Cleanup Maintenance

### Quarterly Reviews
Schedule quarterly documentation audits to prevent similar issues:
- Review architecture document accuracy
- Verify API documentation matches implementation
- Check for deprecated code or unused dependencies
- Update performance targets and metrics

### Documentation Standards
Establish standards to prevent future drift:
- All new features must update architecture document
- API changes require documentation updates
- Deprecated features must be marked clearly
- Regular dependency audits

---

**Plan Created:** October 30, 2025  
**Estimated Effort:** 2-3 developer days  
**Risk Level:** Low  
**Next Review:** January 2026