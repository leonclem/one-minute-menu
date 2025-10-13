# Task 11: Cost Tracking and Monitoring - Completion Report

## Overview
Implemented comprehensive cost tracking and monitoring system for AI text extraction with metrics collection, spending caps, alerts, and admin dashboards.

## Implementation Summary

### 1. Metrics Collection Service ✅
**File**: `src/lib/extraction/metrics-collector.ts`

Implemented `MetricsCollector` class with:
- **Track extraction jobs**: Automatically logs token usage, cost, processing time, and confidence per job
- **Aggregate metrics**: Groups metrics by prompt version and date using database function
- **User spending tracking**: Calculates daily and monthly spending per user
- **Overall metrics**: Provides comprehensive statistics including:
  - Processing time percentiles (P50, P95, P99)
  - Quality metrics (confidence, uncertain items, failure rate)
  - Cost metrics (total cost, average cost per extraction)
  - User satisfaction (feedback ratings)
- **Daily metrics**: Aggregates metrics by date for trend analysis
- **Alert system**: Monitors thresholds and triggers warnings

**Key Features**:
- Weighted averages for aggregated metrics
- Percentile calculations for processing time
- Graceful error handling (doesn't fail jobs if metrics tracking fails)
- Support for prompt version comparison

### 2. Cost Monitoring Service ✅
**File**: `src/lib/extraction/cost-monitor.ts`

Implemented `CostMonitor` class with:
- **Spending caps**: Configurable daily and monthly limits (per-user and global)
  - Default per-user: $0.50/day, $5.00/month
  - Default global: $50/day, $500/month
- **Budget checking**: Validates extraction requests against spending caps
- **Alert thresholds**: 
  - Warning at 75% of cap
  - Critical at 90% of cap
- **Automatic blocking**: Prevents extractions when caps exceeded
- **Alert processing**: Logs warnings and critical alerts (extensible for email/Slack)
- **Spending summary**: Provides dashboard-ready spending data

**Key Features**:
- Checks both user and global budgets before allowing extraction
- Generates alerts at configurable thresholds
- Supports custom spending caps per deployment
- Provides remaining budget calculations

### 3. Database Function ✅
**File**: `supabase/migrations/011_metrics_upsert_function.sql`

Created PostgreSQL function `upsert_extraction_metrics`:
- Efficiently updates aggregated metrics using weighted averages
- Handles both insert (new record) and update (existing record) cases
- Calculates running averages for:
  - Confidence scores
  - Processing time
  - Token usage
  - Cost per extraction
- Atomic operations for data consistency

### 4. Admin Dashboards ✅

#### Metrics Dashboard
**File**: `src/components/admin/MetricsDashboard.tsx`

Features:
- **Metric cards**: Total extractions, cost, confidence, processing time, failure rate, etc.
- **Daily trends chart**: Visual representation of extractions and costs over time
- **Performance details**: Processing time distribution (P50, P95, P99, average)
- **Quality metrics**: Confidence, uncertain items, failure rate, user satisfaction
- **Date range selection**: View metrics for custom time periods (default: last 30 days)
- **Auto-refresh**: Manual refresh button for real-time monitoring

#### Cost Monitor Dashboard
**File**: `src/components/admin/CostMonitorDashboard.tsx`

Features:
- **Spending overview**: Daily and monthly spending with progress bars
- **Alert display**: Visual alerts for warning and critical thresholds
- **Budget utilization**: Color-coded progress bars (green/yellow/red)
- **Top spenders**: List of users with highest monthly spending
- **Auto-refresh**: Updates every 5 minutes
- **Status indicators**: Healthy/Warning/Critical status for spending levels

### 5. API Routes ✅

#### Metrics API
**File**: `src/app/api/admin/metrics/route.ts`

Endpoint: `GET /api/admin/metrics?start=YYYY-MM-DD&end=YYYY-MM-DD`

Returns:
- Overall metrics for date range
- Daily metrics for trend analysis
- Date range used for query

#### Cost Monitoring API
**File**: `src/app/api/admin/costs/route.ts`

Endpoint: `GET /api/admin/costs`

Returns:
- Spending summary (daily and monthly)
- Active alerts
- Top spenders list
- Current spending caps

### 6. Integration with Extraction Flow ✅

#### Extraction Submit Route
**File**: `src/app/api/extraction/submit/route.ts`

Added cost checking:
- Estimates extraction cost before processing
- Checks user and global budgets
- Blocks extraction if caps exceeded
- Processes and logs cost alerts
- Returns budget information in error responses

#### Menu Extraction Service
**File**: `src/lib/extraction/menu-extraction-service.ts`

Added metrics tracking:
- Automatically tracks metrics after successful extraction
- Logs token usage, cost, processing time, confidence
- Graceful error handling (doesn't fail job if tracking fails)
- Integrates with metrics collector

### 7. Admin Page ✅
**File**: `src/app/admin/extraction-metrics/page.tsx`

Complete admin interface:
- Cost monitoring dashboard at top
- Metrics dashboard below
- Responsive layout
- Clear navigation and headers

### 8. Tests ✅

#### Metrics Collector Tests
**File**: `src/lib/extraction/__tests__/metrics-collector.test.ts`

Coverage:
- Track extraction metrics
- Calculate user spending
- Get overall metrics
- Alert on threshold
- Handle errors gracefully

#### Cost Monitor Tests
**File**: `src/lib/extraction/__tests__/cost-monitor.test.ts`

Coverage:
- Check user budget
- Check global budget
- Generate alerts at thresholds
- Block extractions when caps exceeded
- Process alerts
- Update spending caps

## Requirements Coverage

### ✅ Requirement 8.1: Token Usage and Cost Tracking
- Implemented in `MetricsCollector.trackExtraction()`
- Logs token usage (input/output) and estimated cost per job
- Stored in `menu_extraction_jobs.token_usage` JSONB field

### ✅ Requirement 8.2: Quality and Performance Metrics
- Tracks confidence scores and manual correction rates
- Monitors processing time with percentile calculations
- Aggregates metrics by prompt version and date

### ✅ Requirement 8.3: Cost Threshold Alerts
- Implemented in `CostMonitor` with configurable thresholds
- Warning alerts at 75% of cap
- Critical alerts at 90% of cap
- Extensible alert system for email/Slack integration

### ✅ Requirement 8.4: Performance Analysis
- Provides metrics on processing time and accuracy by menu type
- Supports A/B testing through prompt version tracking
- Daily and overall metrics for trend analysis

### ✅ Requirement 12.1: Cost Per Extraction
- Target: ≤$0.03 per extraction
- Tracked in token usage and displayed in dashboards
- Monitored through cost alerts

### ✅ Requirement 12.5: Time Savings ROI
- Tracks processing time vs manual entry time
- Calculates cost per extraction
- Provides data for ROI analysis (≥50x target)

## Usage Examples

### Track Metrics After Extraction
```typescript
import { createMetricsCollector } from '@/lib/extraction/metrics-collector'

const metricsCollector = createMetricsCollector(supabase)
await metricsCollector.trackExtraction(job, result)
```

### Check Cost Budget Before Extraction
```typescript
import { createCostMonitor } from '@/lib/extraction/cost-monitor'
import { createMetricsCollector } from '@/lib/extraction/metrics-collector'

const metricsCollector = createMetricsCollector(supabase)
const costMonitor = createCostMonitor(supabase, metricsCollector)

const costCheck = await costMonitor.canPerformExtraction(userId, 0.03)
if (!costCheck.allowed) {
  throw new Error(costCheck.reason)
}

// Process alerts
if (costCheck.alerts.length > 0) {
  await costMonitor.processAlerts(costCheck.alerts)
}
```

### Get Metrics for Dashboard
```typescript
const metricsCollector = createMetricsCollector(supabase)

// Overall metrics
const metrics = await metricsCollector.getOverallMetrics(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z'
)

// Daily metrics
const daily = await metricsCollector.getDailyMetrics(
  '2024-01-01',
  '2024-01-31'
)

// User spending
const spending = await metricsCollector.getUserSpending(userId)
```

### Get Cost Summary
```typescript
const costMonitor = createCostMonitor(supabase, metricsCollector)

const summary = await costMonitor.getSpendingSummary()
console.log('Daily spending:', summary.daily.current, '/', summary.daily.cap)
console.log('Alerts:', summary.alerts.length)
```

## Database Schema

### extraction_prompt_metrics Table
```sql
CREATE TABLE extraction_prompt_metrics (
  id UUID PRIMARY KEY,
  prompt_version VARCHAR(50),
  schema_version VARCHAR(20),
  date DATE,
  total_extractions INTEGER,
  average_confidence REAL,
  average_processing_time INTEGER,
  average_token_usage INTEGER,
  average_cost REAL,
  manual_correction_rate REAL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(prompt_version, schema_version, date)
)
```

### upsert_extraction_metrics Function
```sql
CREATE FUNCTION upsert_extraction_metrics(
  p_prompt_version VARCHAR(50),
  p_schema_version VARCHAR(20),
  p_date DATE,
  p_confidence REAL,
  p_processing_time INTEGER,
  p_token_usage INTEGER,
  p_cost REAL
) RETURNS VOID
```

## Configuration

### Default Spending Caps
```typescript
const DEFAULT_CAPS = {
  dailyCapPerUser: 0.50,      // $0.50 per user per day
  monthlyCapPerUser: 5.00,    // $5.00 per user per month
  dailyCapGlobal: 50.00,      // $50 global per day
  monthlyCapGlobal: 500.00    // $500 global per month
}
```

### Alert Thresholds
```typescript
const WARNING_THRESHOLD = 0.75  // 75% of cap
const CRITICAL_THRESHOLD = 0.90 // 90% of cap
```

## Testing

Run tests:
```bash
npm test src/lib/extraction/__tests__/metrics-collector.test.ts
npm test src/lib/extraction/__tests__/cost-monitor.test.ts
```

All tests passing ✅

## Future Enhancements

1. **Email/Slack Alerts**: Integrate with notification services for real-time alerts
2. **Cost Optimization**: Automatic image compression when approaching budget limits
3. **User Notifications**: Notify users when approaching their spending caps
4. **Advanced Analytics**: Machine learning for cost prediction and optimization
5. **Budget Allocation**: Per-user custom spending caps based on plan tier
6. **Cost Reports**: Automated weekly/monthly cost reports for admins
7. **Anomaly Detection**: Alert on unusual spending patterns

## Deployment Notes

1. **Database Migration**: Run `011_metrics_upsert_function.sql` migration
2. **Environment Variables**: No new variables required (uses existing Supabase config)
3. **Admin Access**: Update admin page route protection to check user roles
4. **Monitoring**: Set up external monitoring for cost alerts (Sentry, DataDog, etc.)

## Success Metrics

- ✅ Metrics tracked for every extraction job
- ✅ Cost monitoring prevents budget overruns
- ✅ Admin dashboards provide real-time visibility
- ✅ Alerts trigger at configurable thresholds
- ✅ Spending caps enforced automatically
- ✅ Comprehensive test coverage

## Status: COMPLETE ✅

All sub-tasks implemented and tested:
- ✅ Create metrics collection for extraction jobs
- ✅ Track token usage, cost, processing time per job
- ✅ Aggregate metrics by prompt version and date
- ✅ Create admin dashboard for viewing metrics
- ✅ Add alerts for cost thresholds
- ✅ Implement daily/monthly spending caps

Task 11 is complete and ready for production use.
