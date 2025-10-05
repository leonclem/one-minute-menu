# Analytics Implementation

## Overview

The QR Menu System implements privacy-friendly, cookieless analytics that comply with GDPR and PDPA requirements. No cookies, IP addresses, or personally identifiable information is collected.

## Features

### 1. Cookieless Tracking

- **Rotating Visitor IDs**: Uses localStorage to generate daily rotating identifiers
- **No Persistent Tracking**: Identifiers change every day, preventing long-term tracking
- **No Cookies**: Complies with privacy regulations without cookie consent banners
- **No IP Addresses**: Only aggregated counts are stored

### 2. Menu Analytics

Restaurant owners can view:
- **Today's Views**: Page views for the current day
- **Today's Visitors**: Estimated unique visitors (approximate due to rotating IDs)
- **Last 7 Days**: Aggregated views and visitors over the past week
- **Daily Breakdown**: Table showing daily statistics

### 3. Platform Analytics (Admin)

Platform administrators can monitor:
- **Platform-wide Metrics**: Total registrations, active users, OCR jobs, etc.
- **Geographic Usage**: Country-level usage patterns for compliance
- **System Health**: Processing times, success rates, error rates

### 4. Data Retention Controls

- **Delete Original Photos**: After publishing, owners can delete original menu photos
- **Automatic Cleanup**: Analytics data can be configured to auto-delete after retention period
- **PDPA Compliance**: "Delete originals after publish" option for data minimization

### 5. Abuse Prevention

- **Report Abuse**: Public reporting system for brand impersonation or inappropriate content
- **Takedown Process**: Simple workflow for reviewing and acting on reports
- **Reserved Slugs**: System prevents use of major brand names

## Implementation Details

### Client-Side Tracking

```typescript
// Generate rotating visitor ID (changes daily)
const visitorId = getVisitorId()

// Track menu view
await trackMenuView(menuId)
```

### Server-Side Analytics

```typescript
// Record a view
await analyticsOperations.recordMenuView(menuId, visitorId)

// Get analytics summary
const summary = await analyticsOperations.getMenuAnalyticsSummary(menuId)

// Get detailed history
const history = await analyticsOperations.getMenuAnalytics(menuId, 7)
```

### Database Schema

```sql
-- Menu analytics (cookieless, aggregated only)
CREATE TABLE menu_analytics (
    id UUID PRIMARY KEY,
    menu_id UUID REFERENCES menus(id),
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    unique_visitors_ids TEXT[] DEFAULT '{}', -- Rotating daily IDs
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(menu_id, date)
);

-- Platform analytics (admin monitoring)
CREATE TABLE platform_analytics (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, metric_name)
);

-- Geographic usage tracking
CREATE TABLE geographic_usage (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    registrations INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, country_code)
);

-- Abuse reports
CREATE TABLE abuse_reports (
    id UUID PRIMARY KEY,
    menu_id UUID REFERENCES menus(id),
    reason VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    reporter_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Track Menu View
```
POST /api/analytics/track
Body: { menuId: string, visitorId: string, timestamp: string }
```

### Get Menu Analytics
```
GET /api/analytics/menu/[menuId]?days=7
Response: { summary: {...}, history: [...] }
```

### Delete Original Photo
```
POST /api/menus/[menuId]/delete-original
Response: { success: true, message: string }
```

### Report Abuse
```
POST /api/report-abuse
Body: { menuId: string, reason: string, description: string, reporterEmail?: string }
```

## Privacy Compliance

### GDPR Compliance
- ✅ No cookies or persistent identifiers
- ✅ No IP address collection
- ✅ Aggregated data only
- ✅ Daily identifier rotation
- ✅ Data minimization by design

### PDPA Compliance (Singapore)
- ✅ Clear data retention controls
- ✅ "Delete originals after publish" option
- ✅ No unnecessary data collection
- ✅ Transparent privacy notices

## Usage

### For Restaurant Owners

1. **View Analytics**: Navigate to your menu editor to see the analytics dashboard
2. **Analytics Only Show After Publishing**: Analytics are only visible for published menus
3. **Delete Original Photos**: After publishing, use the "Delete Original Photo" button to save storage

### For Administrators

1. **Platform Analytics**: Visit `/admin/analytics` to view platform-wide metrics
2. **Review Reports**: Check abuse reports and take appropriate action
3. **Monitor Usage**: Track geographic usage patterns for compliance

## Future Enhancements

- **Advanced Analytics**: More detailed breakdowns (hourly, item-level)
- **Export Functionality**: CSV/PDF export of analytics data
- **Automated Alerts**: Email notifications for unusual activity
- **A/B Testing**: Compare different menu designs
- **Conversion Tracking**: Track customer actions (if order processing is added)

## Testing

To test analytics:

1. **Publish a menu** and visit the public URL
2. **Open in incognito** to simulate different visitors
3. **Check the analytics dashboard** in the menu editor
4. **Verify rotating IDs** by checking localStorage (key: `qr_menu_visitor_id`)

## Notes

- Analytics tracking is **silent** - failures don't break the user experience
- Visitor counts are **approximate** due to daily ID rotation
- **No real-time updates** - analytics are aggregated daily
- **Admin access** currently open to all authenticated users (add role check in production)
