# ML Metrics Collection Guide

## Overview

This guide documents the metrics collection infrastructure designed to support future machine learning-based layout optimization. The system collects comprehensive data about menu characteristics, layout selections, user behavior, and satisfaction to build a training dataset for ML models.

## Current State (MVP)

The metrics infrastructure is **fully implemented** but ML-specific fields are **optional placeholders**. The system currently:

1. ✅ Collects performance metrics (timing, memory usage)
2. ✅ Tracks menu characteristics (items, sections, images)
3. ✅ Records layout selection decisions
4. ✅ Provides interfaces for user feedback (not yet collected)
5. ✅ Supports engagement tracking (not yet implemented in UI)

## Future ML Capabilities

Once user feedback and engagement tracking are added to the UI, the system will enable:

- **Preset Recommendation**: Predict optimal preset based on menu characteristics
- **Layout Scoring**: Score layouts aesthetically using trained models
- **A/B Testing**: Compare different layout algorithms
- **Personalization**: Learn user preferences over time
- **Anomaly Detection**: Identify unusual menu structures

## Data Collection Architecture

### 1. Base Metrics (Currently Collected)

```typescript
interface LayoutMetrics {
  // Identifiers
  menuId: string
  userId?: string
  
  // Menu characteristics
  sectionCount: number
  totalItems: number
  imageRatio: number
  avgNameLength: number
  hasDescriptions: boolean
  
  // Layout selection
  selectedPreset: string
  outputContext: OutputContext
  
  // Performance
  calculationTime: number
  renderTime: number
  exportTime?: number
  totalTime: number
  memoryUsage?: number
  
  // Timestamp
  timestamp: Date
}
```

### 2. User Feedback (Future - UI Integration Needed)

```typescript
interface UserFeedback {
  // User satisfaction rating (1-5 scale)
  userSatisfaction?: number
  
  // Whether user changed preset after auto-selection
  presetChanged?: boolean
  
  // The preset user manually selected
  userSelectedPreset?: string
}
```

**How to Collect:**
- Show feedback prompt after layout generation
- Track preset changes in UI state
- Log when user manually switches presets

**Example UI Implementation:**
```typescript
// In template preview page
const [userRating, setUserRating] = useState<number>()

const handleRatingSubmit = async (rating: number) => {
  const updatedMetrics = addUserFeedback(metrics, rating, presetChanged, userSelectedPreset)
  await logLayoutMetrics(updatedMetrics)
  
  // Convert to ML training data if rating provided
  const trainingData = convertToMLTrainingData(updatedMetrics)
  if (trainingData) {
    await saveToMLDataset(trainingData)
  }
}

return (
  <div>
    <LayoutPreview />
    <FeedbackPrompt onSubmit={handleRatingSubmit} />
  </div>
)
```

### 3. Engagement Metrics (Future - Analytics Integration)

```typescript
interface EngagementMetrics {
  viewDuration?: number    // Seconds spent viewing layout
  exportCount?: number     // Number of exports
  shareCount?: number      // Number of shares
  editCount?: number       // Number of manual edits
}
```

**How to Collect:**
- Track time on page with `useEffect` hook
- Increment counters on export/share/edit actions
- Store in component state and flush on unmount

**Example Implementation:**
```typescript
const [engagement, setEngagement] = useState<EngagementMetrics>({
  viewDuration: 0,
  exportCount: 0,
  shareCount: 0,
  editCount: 0
})

// Track view duration
useEffect(() => {
  const startTime = Date.now()
  return () => {
    const duration = (Date.now() - startTime) / 1000
    const updatedMetrics = trackEngagement(metrics, {
      ...engagement,
      viewDuration: duration
    })
    logLayoutMetrics(updatedMetrics)
  }
}, [])

// Track exports
const handleExport = async (format: string) => {
  await exportLayout(format)
  setEngagement(prev => ({ ...prev, exportCount: (prev.exportCount ?? 0) + 1 }))
}
```

### 4. Advanced Characteristics (Future - Enhanced Analysis)

```typescript
interface AdvancedCharacteristics {
  priceRange?: { min: number; max: number }
  avgDescriptionLength?: number
  featuredItemCount?: number
  sectionsWithImages?: number
  longestSectionItems?: number
  shortestSectionItems?: number
  cuisineType?: string
  menuType?: 'breakfast' | 'lunch' | 'dinner' | 'drinks' | 'dessert' | 'full'
}
```

**How to Collect:**
- Calculate from menu data during transformation
- Infer cuisine type from menu name/items (future NLP)
- Detect menu type from section names

**Example Implementation:**
```typescript
function calculateAdvancedCharacteristics(menu: LayoutMenuData): AdvancedCharacteristics {
  const allItems = menu.sections.flatMap(s => s.items)
  const prices = allItems.map(i => i.price).filter(p => p > 0)
  
  return {
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices)
    },
    avgDescriptionLength: allItems
      .filter(i => i.description)
      .reduce((sum, i) => sum + (i.description?.length ?? 0), 0) / allItems.length,
    featuredItemCount: allItems.filter(i => i.featured).length,
    sectionsWithImages: menu.sections.filter(s => 
      s.items.some(i => i.imageRef)
    ).length,
    longestSectionItems: Math.max(...menu.sections.map(s => s.items.length)),
    shortestSectionItems: Math.min(...menu.sections.map(s => s.items.length)),
    cuisineType: inferCuisineType(menu), // Future NLP
    menuType: inferMenuType(menu.sections) // Based on section names
  }
}
```

## ML Training Data Format

### MLTrainingData Interface

```typescript
interface MLTrainingData {
  features: {
    // Menu characteristics (input features)
    sectionCount: number
    totalItems: number
    imageRatio: number
    avgNameLength: number
    hasDescriptions: boolean
    avgDescriptionLength?: number
    priceRange?: { min: number; max: number }
    featuredItemCount?: number
    sectionsWithImages?: number
    longestSectionItems?: number
    shortestSectionItems?: number
    outputContext: OutputContext
    cuisineType?: string
    menuType?: string
  }
  
  labels: {
    // Target variables (what we want to predict)
    optimalPreset: string
    userSatisfaction: number
    engagementScore: number
  }
  
  // Metadata
  menuId: string
  userId?: string
  timestamp: Date
}
```

### Conversion Process

```typescript
// Collect base metrics
const metrics = new MetricsBuilder()
  .setMenuId(menuId)
  .setMenuCharacteristics(characteristics)
  .setLayoutSelection(preset, context)
  .markCalculationStart()
  // ... perform layout generation
  .markCalculationEnd()
  .build()

// Add user feedback (when available)
const metricsWithFeedback = addUserFeedback(metrics, userRating, presetChanged, userSelectedPreset)

// Add engagement data (when available)
const metricsWithEngagement = trackEngagement(metricsWithFeedback, engagement)

// Add advanced characteristics (when available)
const fullMetrics = addAdvancedCharacteristics(metricsWithEngagement, advancedChars)

// Convert to ML training format
const trainingData = convertToMLTrainingData(fullMetrics)

// Save to dataset
if (trainingData) {
  await saveToMLDataset(trainingData)
}
```

## Engagement Score Calculation

The engagement score is a composite metric (0-100) that combines multiple signals:

### Scoring Formula

```typescript
function calculateEngagementScore(engagement?: EngagementMetrics): number {
  let score = 0
  
  // View duration (max 30 points)
  // 0-30s = 0-10 pts, 30-120s = 10-20 pts, 120+s = 20-30 pts
  if (engagement?.viewDuration) {
    if (engagement.viewDuration < 30) {
      score += (engagement.viewDuration / 30) * 10
    } else if (engagement.viewDuration < 120) {
      score += 10 + ((engagement.viewDuration - 30) / 90) * 10
    } else {
      score += 20 + Math.min(((engagement.viewDuration - 120) / 180) * 10, 10)
    }
  }
  
  // Export count (max 30 points)
  // 1 export = 10 pts, 2 = 20 pts, 3+ = 30 pts
  if (engagement?.exportCount) {
    score += Math.min(engagement.exportCount * 10, 30)
  }
  
  // Share count (max 20 points)
  // 1 share = 10 pts, 2+ = 20 pts
  if (engagement?.shareCount) {
    score += Math.min(engagement.shareCount * 10, 20)
  }
  
  // Edit count (max 20 points)
  // Fewer edits = higher score (satisfaction with initial layout)
  // 0 edits = 20 pts, 1-2 edits = 10 pts, 3+ edits = 0 pts
  if (engagement?.editCount !== undefined) {
    if (engagement.editCount === 0) {
      score += 20
    } else if (engagement.editCount <= 2) {
      score += 10
    }
  }
  
  return Math.min(score, 100)
}
```

### Interpretation

- **0-30**: Low engagement (quick view, no actions)
- **31-60**: Moderate engagement (some interaction)
- **61-80**: High engagement (multiple exports/shares)
- **81-100**: Very high engagement (extended use, minimal edits)

## Data Storage

### Database Schema (Future Implementation)

```sql
-- ML training data table
CREATE TABLE ml_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  
  -- Features (JSONB for flexibility)
  features JSONB NOT NULL,
  
  -- Labels
  optimal_preset TEXT NOT NULL,
  user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
  engagement_score NUMERIC(5,2) CHECK (engagement_score BETWEEN 0 AND 100),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_features CHECK (jsonb_typeof(features) = 'object')
);

CREATE INDEX idx_ml_training_menu ON ml_training_data(menu_id);
CREATE INDEX idx_ml_training_user ON ml_training_data(user_id);
CREATE INDEX idx_ml_training_preset ON ml_training_data(optimal_preset);
CREATE INDEX idx_ml_training_satisfaction ON ml_training_data(user_satisfaction);
CREATE INDEX idx_ml_training_created ON ml_training_data(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_ml_training_features ON ml_training_data USING GIN (features);
```

### Storage Implementation

```typescript
export async function saveToMLDataset(data: MLTrainingData): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('ml_training_data')
    .insert({
      menu_id: data.menuId,
      user_id: data.userId,
      features: data.features,
      optimal_preset: data.labels.optimalPreset,
      user_satisfaction: data.labels.userSatisfaction,
      engagement_score: data.labels.engagementScore,
      created_at: data.timestamp.toISOString()
    })
  
  if (error) {
    console.error('Failed to save ML training data:', error)
    throw error
  }
}
```

## Data Export for ML Training

### CSV Export

```typescript
// Export dataset to CSV for analysis
const dataset = await fetchMLDataset()
const csv = exportMLDatasetToCSV(dataset)

// Download or upload to ML platform
fs.writeFileSync('ml_training_data.csv', csv)
```

### JSON Export

```typescript
// Export as JSON for Python ML libraries
const dataset = await fetchMLDataset()
const json = JSON.stringify(dataset, null, 2)
fs.writeFileSync('ml_training_data.json', json)
```

### Direct Database Query

```sql
-- Export features and labels for ML training
SELECT 
  features->>'sectionCount' as section_count,
  features->>'totalItems' as total_items,
  features->>'imageRatio' as image_ratio,
  features->>'avgNameLength' as avg_name_length,
  features->>'hasDescriptions' as has_descriptions,
  features->>'outputContext' as output_context,
  optimal_preset,
  user_satisfaction,
  engagement_score
FROM ml_training_data
WHERE user_satisfaction IS NOT NULL
ORDER BY created_at DESC;
```

## ML Model Training (Future)

### Preset Recommendation Model

**Goal**: Predict optimal preset based on menu characteristics

**Input Features**:
- sectionCount
- totalItems
- imageRatio
- avgNameLength
- hasDescriptions
- outputContext

**Target Label**: optimalPreset

**Model Type**: Multi-class classification (5 presets)

**Example Training Code (Python)**:
```python
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# Load data
df = pd.read_csv('ml_training_data.csv')

# Features
X = df[['section_count', 'total_items', 'image_ratio', 
        'avg_name_length', 'has_descriptions']]

# Target
y = df['optimal_preset']

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train model
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# Evaluate
accuracy = model.score(X_test, y_test)
print(f'Accuracy: {accuracy:.2%}')
```

### Layout Quality Scoring Model

**Goal**: Predict user satisfaction based on layout characteristics

**Input Features**:
- All menu characteristics
- Selected preset
- Output context

**Target Label**: userSatisfaction (1-5)

**Model Type**: Regression or ordinal classification

### Engagement Prediction Model

**Goal**: Predict engagement score based on layout choices

**Input Features**:
- Menu characteristics
- Selected preset
- User history (if available)

**Target Label**: engagementScore (0-100)

**Model Type**: Regression

## A/B Testing Support

### Variant Tracking

```typescript
// Assign A/B test variant
const variant = Math.random() < 0.5 ? 'control' : 'experimental'

const metrics = new MetricsBuilder()
  .setMenuId(menuId)
  // ... other metrics
  .build()

// Add A/B test variant
const metricsWithVariant = {
  ...metrics,
  abTestVariant: variant
}

logLayoutMetrics(metricsWithVariant)
```

### Analysis Query

```sql
-- Compare A/B test variants
SELECT 
  ab_test_variant,
  COUNT(*) as sample_size,
  AVG(user_satisfaction) as avg_satisfaction,
  AVG(engagement_score) as avg_engagement,
  AVG(total_time) as avg_time_ms
FROM ml_training_data
WHERE ab_test_variant IS NOT NULL
GROUP BY ab_test_variant;
```

## Privacy and Compliance

### Data Anonymization

```typescript
// Remove PII before storing
function anonymizeMetrics(metrics: LayoutMetrics): LayoutMetrics {
  return {
    ...metrics,
    userId: undefined, // Remove user ID
    menuId: hashMenuId(metrics.menuId) // Hash menu ID
  }
}
```

### Data Retention

```sql
-- Delete old training data (GDPR compliance)
DELETE FROM ml_training_data
WHERE created_at < NOW() - INTERVAL '2 years';
```

### User Consent

```typescript
// Only collect ML data if user consents
if (userConsent.analytics && userConsent.mlTraining) {
  const trainingData = convertToMLTrainingData(metrics)
  if (trainingData) {
    await saveToMLDataset(trainingData)
  }
}
```

## Monitoring and Validation

### Data Quality Checks

```typescript
// Validate training data before saving
function validateMLData(data: MLTrainingData): string[] {
  const errors: string[] = []
  
  // Check feature ranges
  if (data.features.sectionCount < 1) {
    errors.push('Invalid section count')
  }
  if (data.features.imageRatio < 0 || data.features.imageRatio > 100) {
    errors.push('Invalid image ratio')
  }
  
  // Check label ranges
  if (data.labels.userSatisfaction < 1 || data.labels.userSatisfaction > 5) {
    errors.push('Invalid satisfaction rating')
  }
  if (data.labels.engagementScore < 0 || data.labels.engagementScore > 100) {
    errors.push('Invalid engagement score')
  }
  
  return errors
}
```

### Dataset Statistics

```sql
-- Dataset statistics
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT menu_id) as unique_menus,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(user_satisfaction) as avg_satisfaction,
  AVG(engagement_score) as avg_engagement,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM ml_training_data;

-- Preset distribution
SELECT 
  optimal_preset,
  COUNT(*) as count,
  AVG(user_satisfaction) as avg_satisfaction
FROM ml_training_data
GROUP BY optimal_preset
ORDER BY count DESC;
```

## Implementation Roadmap

### Phase 1: Foundation (Current - MVP)
- ✅ Metrics infrastructure
- ✅ Performance tracking
- ✅ Data interfaces defined

### Phase 2: User Feedback (Next)
- [ ] Add feedback UI component
- [ ] Track preset changes
- [ ] Collect satisfaction ratings
- [ ] Store feedback in database

### Phase 3: Engagement Tracking
- [ ] Implement view duration tracking
- [ ] Track export/share/edit actions
- [ ] Calculate engagement scores
- [ ] Store engagement data

### Phase 4: Advanced Characteristics
- [ ] Calculate price ranges
- [ ] Analyze description lengths
- [ ] Infer cuisine types (NLP)
- [ ] Detect menu types

### Phase 5: ML Model Training
- [ ] Export training dataset
- [ ] Train preset recommendation model
- [ ] Train satisfaction prediction model
- [ ] Deploy models for inference

### Phase 6: Production ML
- [ ] Integrate models into layout selector
- [ ] A/B test ML vs heuristic selection
- [ ] Monitor model performance
- [ ] Retrain models periodically

## Conclusion

The ML metrics collection infrastructure is fully implemented and ready to collect data. The system is designed to:

1. **Start Simple**: Collect basic metrics now
2. **Scale Gradually**: Add user feedback and engagement tracking incrementally
3. **Enable ML**: Provide all data needed for future ML models
4. **Maintain Privacy**: Support anonymization and consent
5. **Stay Flexible**: Use JSONB for evolving feature sets

Key next steps:
1. Add feedback UI to collect user satisfaction ratings
2. Implement engagement tracking in template preview page
3. Store data in database for ML training
4. Export dataset and train initial models
5. Integrate models back into layout selector

The foundation is solid and extensible for future ML capabilities.
