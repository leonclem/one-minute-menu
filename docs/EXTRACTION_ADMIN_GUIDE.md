# Menu Extraction Admin Guide

## Overview

This guide is for system administrators and operators who need to monitor, manage, and optimize the AI menu extraction system. It covers cost management, performance monitoring, troubleshooting, and system maintenance.

## Table of Contents

1. [Admin Dashboard Access](#admin-dashboard-access)
2. [Cost Monitoring and Management](#cost-monitoring-and-management)
3. [Performance Metrics](#performance-metrics)
4. [Quality Monitoring](#quality-monitoring)
5. [User Feedback Analysis](#user-feedback-analysis)
6. [Prompt Management](#prompt-management)
7. [Troubleshooting](#troubleshooting)
8. [System Maintenance](#system-maintenance)
9. [Security and Access Control](#security-and-access-control)
10. [Optimization Strategies](#optimization-strategies)

---

## Admin Dashboard Access

### Accessing Admin Features

**Admin Dashboards:**
- `/admin/extraction-metrics` - Cost and performance metrics
- `/admin/analytics` - User analytics and feedback
- `/admin/prompts` - Prompt version management (future)

**Access Requirements:**
- Admin role in user metadata
- Valid authentication session
- Appropriate permissions

**Setting Up Admin Access:**

1. **Assign Admin Role (Database)**
   ```sql
   -- Update user metadata to add admin role
   UPDATE auth.users
   SET raw_user_meta_data = 
     jsonb_set(
       COALESCE(raw_user_meta_data, '{}'::jsonb),
       '{role}',
       '"admin"'
     )
   WHERE email = 'admin@example.com';
   ```

2. **Verify Admin Access**
   - Log in with admin account
   - Navigate to `/admin/extraction-metrics`
   - Should see full dashboard (not redirected)

3. **Troubleshooting Access Issues**
   - Check user metadata has `role: "admin"`
   - Verify session is valid
   - Clear browser cache and re-login
   - Check RLS policies on admin tables

### Admin Role Management

**Best Practices:**
- Limit admin access to trusted personnel
- Use separate admin accounts (not personal)
- Audit admin actions regularly
- Rotate admin credentials periodically

**Creating Admin Accounts:**
```sql
-- Create admin user
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  'admin@example.com',
  crypt('secure_password', gen_salt('bf')),
  NOW(),
  '{"role": "admin"}'::jsonb
);
```

**Revoking Admin Access:**
```sql
-- Remove admin role
UPDATE auth.users
SET raw_user_meta_data = 
  raw_user_meta_data - 'role'
WHERE email = 'admin@example.com';
```

---

## Cost Monitoring and Management

### Understanding Costs

**Cost Components:**
- **Input tokens:** Menu image converted to tokens
- **Output tokens:** Extracted JSON response
- **API calls:** Per-extraction API request
- **Storage:** Image storage (minimal)

**Typical Costs:**
- Stage 1: $0.02-0.03 per extraction
- Stage 2: $0.03-0.05 per extraction
- Average: ~$0.03 per extraction

**Cost Factors:**
- Image resolution (higher = more tokens)
- Menu complexity (more items = more output tokens)
- Schema version (Stage 2 uses more tokens)
- Retry attempts (failed extractions)

### Cost Dashboard

**Accessing Cost Metrics:**
1. Navigate to `/admin/extraction-metrics`
2. View cost overview and trends
3. Filter by date range, user, or prompt version

**Key Metrics:**
- **Total extractions:** Number of jobs processed
- **Total cost:** Cumulative API costs
- **Average cost per extraction:** Cost efficiency
- **Cost by user:** Identify high-usage users
- **Cost by prompt version:** Compare prompt efficiency

**Cost Alerts:**
- Daily spending threshold alerts
- Monthly budget warnings
- Per-user quota alerts
- Unusual cost spike notifications

### Setting Spending Caps

**Daily Spending Cap:**
```typescript
// In environment variables
DAILY_SPENDING_CAP=50.00  // $50 per day

// In code (src/lib/extraction/cost-controls.ts)
export const DAILY_SPENDING_CAP = parseFloat(
  process.env.DAILY_SPENDING_CAP || '50'
)
```

**Monthly Spending Cap:**
```typescript
MONTHLY_SPENDING_CAP=1000.00  // $1000 per month
```

**Per-User Limits:**
```typescript
// Free tier: 5 extractions/month
// Premium tier: 50 extractions/month
// Enterprise: Custom limits
```

**Enforcing Caps:**
- System checks spending before each extraction
- Blocks new extractions if cap exceeded
- Sends alert to admins
- Displays user-friendly error message

### Cost Optimization

**Image Optimization:**
```typescript
// Resize images to optimal resolution
const MAX_DIMENSION = 2048  // pixels
const JPEG_QUALITY = 85     // 0-100

// Compress before sending to API
const optimizedImage = await sharp(imageBuffer)
  .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside' })
  .jpeg({ quality: JPEG_QUALITY })
  .toBuffer()
```

**Prompt Optimization:**
- Use concise instructions
- Minimize example output size
- Set temperature=0 (deterministic)
- Remove unnecessary context

**Caching Strategy:**
```typescript
// Cache results by image hash
const imageHash = crypto
  .createHash('sha256')
  .update(imageBuffer)
  .digest('hex')

// Check cache before API call
const cached = await getCachedExtraction(imageHash)
if (cached) return cached

// Cache result after extraction
await cacheExtraction(imageHash, result)
```

**Batch Processing (Future):**
- Process multiple menu sections in one call
- Amortize API overhead
- Reduce total token usage

---

## Performance Metrics

### Key Performance Indicators

**Processing Time:**
- **Target:** <30 seconds per extraction
- **Acceptable:** 30-60 seconds
- **Slow:** >60 seconds

**Accuracy:**
- **Stage 1 target:** ≥90% field-level accuracy
- **Stage 2 target:** ≥85% overall accuracy
- **Confidence:** ≥85% average confidence score

**User Satisfaction:**
- **Review time:** ≤90 seconds (Stage 1), ≤120 seconds (Stage 2)
- **Completion rate:** ≥80% of extractions published
- **User rating:** ≥4.0/5.0 average

**System Reliability:**
- **Success rate:** ≥95%
- **Retry rate:** ≤10%
- **Error rate:** ≤5%

### Performance Dashboard

**Accessing Metrics:**
1. Navigate to `/admin/extraction-metrics`
2. View performance overview
3. Filter by date range or prompt version

**Key Charts:**
- Processing time distribution (p50, p95, p99)
- Success/failure rate over time
- Confidence score distribution
- Manual correction rate

**Performance Alerts:**
- Processing time exceeds 60 seconds
- Success rate drops below 90%
- Average confidence below 0.8
- High retry rate (>15%)

### Monitoring Queries

**Average Processing Time:**
```sql
SELECT 
  DATE(created_at) as date,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p95
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Success Rate:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM menu_extraction_jobs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Average Confidence:**
```sql
SELECT 
  prompt_version,
  COUNT(*) as extractions,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG((token_usage->>'estimatedCost')::numeric), 4) as avg_cost
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY prompt_version
ORDER BY avg_confidence DESC;
```

---

## Quality Monitoring

### Quality Metrics

**Field-Level Accuracy:**
- Item names correct
- Prices correct
- Categories correct
- Descriptions accurate

**Structural Accuracy:**
- Hierarchical categories preserved
- Items in correct categories
- Subcategories properly nested

**Confidence Scoring:**
- High confidence (≥0.8): Should be accurate
- Medium confidence (0.6-0.8): May need review
- Low confidence (<0.6): Likely needs correction

**Manual Correction Rate:**
- % of items corrected by users
- % of categories reorganized
- % of prices adjusted
- % of items added/removed

### Quality Dashboard

**Accessing Quality Metrics:**
1. Navigate to `/admin/analytics`
2. View quality overview
3. Filter by prompt version or date range

**Key Metrics:**
- Average confidence score
- Manual correction rate
- Uncertain item rate
- User satisfaction rating

**Quality Alerts:**
- Confidence drops below 0.8
- Correction rate exceeds 20%
- Uncertain item rate exceeds 15%
- User satisfaction below 4.0

### Quality Analysis Queries

**Manual Correction Rate:**
```sql
SELECT 
  prompt_version,
  COUNT(*) as total_extractions,
  SUM(CASE WHEN EXISTS (
    SELECT 1 FROM extraction_feedback 
    WHERE job_id = menu_extraction_jobs.id 
      AND feedback_type = 'system_error'
  ) THEN 1 ELSE 0 END) as corrections,
  ROUND(100.0 * SUM(CASE WHEN EXISTS (
    SELECT 1 FROM extraction_feedback 
    WHERE job_id = menu_extraction_jobs.id 
      AND feedback_type = 'system_error'
  ) THEN 1 ELSE 0 END) / COUNT(*), 2) as correction_rate
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY prompt_version
ORDER BY correction_rate ASC;
```

**Uncertain Item Rate:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_extractions,
  AVG(jsonb_array_length(COALESCE(uncertain_items, '[]'::jsonb))) as avg_uncertain_items,
  MAX(jsonb_array_length(COALESCE(uncertain_items, '[]'::jsonb))) as max_uncertain_items
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## User Feedback Analysis

### Feedback Types

**System Error:**
- Extraction incorrect
- Item misidentified
- Price wrong
- Category incorrect

**Menu Unclear:**
- Photo quality poor
- Text unreadable
- Layout confusing
- Ambiguous formatting

**Excellent:**
- Extraction perfect
- No corrections needed
- High satisfaction

### Feedback Dashboard

**Accessing Feedback:**
1. Navigate to `/admin/analytics`
2. View feedback section
3. Filter by type, date, or user

**Key Metrics:**
- Total feedback submissions
- Feedback by type (system_error, menu_unclear, excellent)
- Common correction patterns
- User satisfaction trends

**Feedback Analysis:**
- Identify recurring issues
- Track improvement over time
- Prioritize prompt improvements
- Validate prompt changes

### Feedback Queries

**Feedback Summary:**
```sql
SELECT 
  feedback_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM extraction_feedback
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY feedback_type
ORDER BY count DESC;
```

**Common Corrections:**
```sql
SELECT 
  item_id,
  correction_made,
  COUNT(*) as frequency
FROM extraction_feedback
WHERE feedback_type = 'system_error'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY item_id, correction_made
ORDER BY frequency DESC
LIMIT 20;
```

**User Satisfaction Trend:**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_feedback,
  SUM(CASE WHEN feedback_type = 'excellent' THEN 1 ELSE 0 END) as excellent,
  SUM(CASE WHEN feedback_type = 'system_error' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN feedback_type = 'excellent' THEN 1 ELSE 0 END) / COUNT(*), 2) as satisfaction_rate
FROM extraction_feedback
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Prompt Management

### Prompt Versioning

**Current Versions:**
- **v1.0:** Stage 1 MVP prompt
- **v2.0:** Stage 2 full schema prompt
- **Future:** A/B testing variants

**Version Tracking:**
- All extractions tagged with prompt version
- Metrics tracked per version
- Comparison between versions
- Rollback capability

### Prompt Performance Comparison

**Comparing Versions:**
```sql
SELECT 
  prompt_version,
  COUNT(*) as extractions,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG((token_usage->>'estimatedCost')::numeric), 4) as avg_cost,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))), 1) as avg_seconds
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY prompt_version
ORDER BY prompt_version;
```

**A/B Testing (Future):**
- Route % of traffic to different versions
- Track performance metrics
- Statistical significance testing
- Automatic winner selection

### Prompt Optimization

**Best Practices:**
- Clear, concise instructions
- Specific examples
- Confidence scoring guidance
- Error handling instructions

**Testing New Prompts:**
1. Create new prompt version
2. Test on regression test set
3. Deploy to 10% of traffic
4. Monitor metrics for 7 days
5. Compare to baseline
6. Roll out or roll back

**Rollback Procedure:**
```typescript
// Revert to previous prompt version
const ACTIVE_PROMPT_VERSION = 'v1.0'  // Change back

// Or use feature flag
const PROMPT_VERSION = process.env.PROMPT_VERSION || 'v1.0'
```

---

## Troubleshooting

### Common Issues

#### 1. High Failure Rate

**Symptoms:**
- Success rate <90%
- Many failed extractions
- User complaints

**Diagnosis:**
```sql
-- Check error types
SELECT 
  error,
  COUNT(*) as count
FROM menu_extraction_jobs
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY error
ORDER BY count DESC;
```

**Solutions:**
- Check API key validity
- Verify API rate limits
- Review error logs
- Check image preprocessing
- Validate prompt format

#### 2. Slow Processing

**Symptoms:**
- Processing time >60 seconds
- User complaints about speed
- Timeouts

**Diagnosis:**
```sql
-- Check slow extractions
SELECT 
  id,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as seconds,
  (token_usage->>'inputTokens')::int as input_tokens,
  (token_usage->>'outputTokens')::int as output_tokens
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND EXTRACT(EPOCH FROM (completed_at - created_at)) > 60
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY seconds DESC
LIMIT 10;
```

**Solutions:**
- Optimize image resolution
- Reduce prompt size
- Check API response times
- Increase timeout limits
- Scale infrastructure

#### 3. High Costs

**Symptoms:**
- Cost per extraction >$0.05
- Monthly budget exceeded
- Unexpected charges

**Diagnosis:**
```sql
-- Check high-cost extractions
SELECT 
  id,
  user_id,
  (token_usage->>'inputTokens')::int as input_tokens,
  (token_usage->>'outputTokens')::int as output_tokens,
  (token_usage->>'estimatedCost')::numeric as cost
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND (token_usage->>'estimatedCost')::numeric > 0.05
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY cost DESC
LIMIT 10;
```

**Solutions:**
- Implement image compression
- Optimize prompt length
- Enable result caching
- Set stricter spending caps
- Review high-usage users

#### 4. Low Quality

**Symptoms:**
- Confidence scores <0.8
- High correction rate
- User dissatisfaction

**Diagnosis:**
```sql
-- Check low-confidence extractions
SELECT 
  id,
  confidence,
  prompt_version,
  jsonb_array_length(COALESCE(uncertain_items, '[]'::jsonb)) as uncertain_count
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND confidence < 0.8
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY confidence ASC
LIMIT 10;
```

**Solutions:**
- Review prompt instructions
- Improve confidence scoring logic
- Analyze user feedback
- Test prompt variations
- Update regression tests

---

## System Maintenance

### Regular Maintenance Tasks

**Daily:**
- [ ] Check cost dashboard for anomalies
- [ ] Review failure rate
- [ ] Monitor processing times
- [ ] Check spending against caps

**Weekly:**
- [ ] Analyze user feedback
- [ ] Review quality metrics
- [ ] Check for API issues
- [ ] Update regression tests

**Monthly:**
- [ ] Compare prompt versions
- [ ] Analyze cost trends
- [ ] Review user satisfaction
- [ ] Plan optimizations
- [ ] Update documentation

### Database Maintenance

**Cleanup Old Jobs:**
```sql
-- Archive completed jobs older than 90 days
DELETE FROM menu_extraction_jobs
WHERE status IN ('completed', 'failed')
  AND created_at < NOW() - INTERVAL '90 days';
```

**Vacuum Tables:**
```sql
VACUUM ANALYZE menu_extraction_jobs;
VACUUM ANALYZE extraction_prompt_metrics;
VACUUM ANALYZE extraction_feedback;
```

**Index Maintenance:**
```sql
-- Rebuild indexes if needed
REINDEX TABLE menu_extraction_jobs;
```

### Backup and Recovery

**Backup Strategy:**
- Daily automated backups
- Retain for 30 days
- Test restore procedures monthly

**Critical Data:**
- menu_extraction_jobs table
- extraction_prompt_metrics table
- extraction_feedback table
- Prompt version history

**Recovery Procedures:**
1. Identify data loss scope
2. Restore from latest backup
3. Verify data integrity
4. Notify affected users
5. Document incident

---

## Security and Access Control

### API Key Management

**Best Practices:**
- Store in environment variables
- Never commit to version control
- Rotate keys quarterly
- Use separate keys for staging/production

**Key Rotation:**
```bash
# Update environment variable
export OPENAI_API_KEY="new-key-here"

# Restart application
pm2 restart app

# Verify new key works
curl -X POST /api/extraction/submit \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "image=@test-menu.jpg"
```

**Key Compromise Response:**
1. Immediately revoke compromised key
2. Generate new key
3. Update environment variables
4. Restart services
5. Audit recent usage
6. Notify security team

### User Data Protection

**Privacy Considerations:**
- Menu images may contain sensitive info
- User corrections tracked for improvement
- Feedback may include personal comments

**Data Retention:**
- Images: Delete after extraction (optional)
- Extraction results: Retain for user access
- Feedback: Anonymize after 90 days
- Logs: Retain for 30 days

**GDPR Compliance:**
- User data export on request
- Data deletion on request
- Clear privacy policy
- Consent for feedback collection

### Access Control

**Role-Based Access:**
- **Admin:** Full access to all dashboards
- **User:** Access to own extractions only
- **Support:** Read-only access to user data

**RLS Policies:**
```sql
-- Users can only see own extractions
CREATE POLICY "Users see own jobs" ON menu_extraction_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Admins see all extractions
CREATE POLICY "Admins see all jobs" ON menu_extraction_jobs
  FOR SELECT USING (
    (auth.jwt()->>'user_metadata'->>'role') = 'admin'
  );
```

---

## Optimization Strategies

### Cost Optimization

**Image Optimization:**
- Resize to 1024-2048px
- Compress to 85% JPEG quality
- Convert PNG to JPEG
- Strip EXIF data

**Prompt Optimization:**
- Remove unnecessary examples
- Use concise language
- Minimize schema size
- Set temperature=0

**Caching:**
- Cache by image hash
- Cache for 24 hours
- Invalidate on re-upload
- Monitor cache hit rate

**Batch Processing (Future):**
- Process multiple sections together
- Reduce API call overhead
- Amortize fixed costs

### Performance Optimization

**Async Processing:**
- Submit job and return immediately
- Process in background
- Notify on completion
- Support polling

**Parallel Processing:**
- Process multiple jobs concurrently
- Respect API rate limits
- Queue overflow jobs
- Load balance across workers

**Early Validation:**
- Check image format before API call
- Verify quota before processing
- Detect duplicates via hash
- Fail fast on invalid input

### Quality Optimization

**Prompt Improvements:**
- Analyze user feedback
- Test variations
- A/B test changes
- Iterate based on data

**Confidence Tuning:**
- Adjust scoring thresholds
- Improve uncertain item detection
- Better superfluous text filtering
- Refine category detection

**User Education:**
- Photo best practices guide
- In-app tips and guidance
- Video tutorials
- Proactive error messages

---

## Monitoring Checklist

### Daily Checks

- [ ] Cost within daily cap
- [ ] Success rate ≥95%
- [ ] Processing time <30s average
- [ ] No critical errors in logs

### Weekly Checks

- [ ] Review user feedback
- [ ] Analyze quality metrics
- [ ] Check for API issues
- [ ] Update regression tests

### Monthly Checks

- [ ] Cost trend analysis
- [ ] Prompt performance comparison
- [ ] User satisfaction review
- [ ] System optimization planning

---

## Support and Escalation

### Support Tiers

**Tier 1: User Support**
- Photo quality issues
- Basic troubleshooting
- Feature questions
- Account issues

**Tier 2: Technical Support**
- Extraction failures
- API errors
- Performance issues
- Data corrections

**Tier 3: Engineering**
- System outages
- Critical bugs
- Prompt optimization
- Infrastructure issues

### Escalation Criteria

**Immediate Escalation:**
- System-wide outage
- Data loss or corruption
- Security breach
- API key compromise

**Same-Day Escalation:**
- Success rate <80%
- Cost spike >200% normal
- Multiple user complaints
- Critical bug affecting users

**Next-Day Escalation:**
- Quality degradation
- Performance issues
- Feature requests
- Optimization opportunities

---

## Resources

### Documentation

- [Menu Photo Best Practices](./MENU_PHOTO_BEST_PRACTICES.md)
- [Extraction Troubleshooting](./EXTRACTION_TROUBLESHOOTING.md)
- [Stage Comparison](./EXTRACTION_STAGE_COMPARISON.md)
- [API Documentation](./EXTRACTION_API.md)

### External Resources

- OpenAI API Documentation
- Supabase Documentation
- Next.js Documentation
- PostgreSQL Documentation

### Contact Information

- **Engineering Team:** engineering@example.com
- **Support Team:** support@example.com
- **Security Team:** security@example.com
- **On-Call:** oncall@example.com

---

## Appendix

### Useful SQL Queries

See inline queries throughout this document for:
- Cost analysis
- Performance monitoring
- Quality metrics
- User feedback analysis

### Environment Variables

```bash
# API Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-vision-preview

# Cost Controls
DAILY_SPENDING_CAP=50.00
MONTHLY_SPENDING_CAP=1000.00

# Performance
MAX_IMAGE_DIMENSION=2048
JPEG_QUALITY=85
EXTRACTION_TIMEOUT=180000  # 3 minutes

# Feature Flags
PROMPT_VERSION=v1.0
ENABLE_STAGE2=true
ENABLE_CACHING=true
```

### Monitoring Alerts

Configure alerts for:
- Daily spending >80% of cap
- Success rate <90%
- Processing time >60s
- Confidence <0.8
- Error rate >5%

---

**Last Updated:** [Current Date]  
**Version:** 1.0  
**Maintained By:** Engineering Team
