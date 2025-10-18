# Stage 1 vs Stage 2 Extraction Comparison

## Overview

The AI menu extraction system is implemented in two stages to balance functionality, complexity, and validation. This document explains the differences between Stage 1 (MVP) and Stage 2 (Full Schema) to help you understand which features are available and when to use each.

## Quick Comparison

| Feature | Stage 1 (MVP) | Stage 2 (Full Schema) |
|---------|---------------|----------------------|
| **Item Name** | ✅ Yes | ✅ Yes |
| **Price** | ✅ Yes (single) | ✅ Yes (multiple variants) |
| **Description** | ✅ Yes | ✅ Yes |
| **Categories** | ✅ Yes (hierarchical) | ✅ Yes (hierarchical) |
| **Subcategories** | ✅ Yes | ✅ Yes |
| **Multiple Sizes/Prices** | ❌ No | ✅ Yes (variants) |
| **Modifier Groups** | ❌ No | ✅ Yes (sauces, add-ons) |
| **Set Menus** | ❌ No | ✅ Yes (courses, options) |
| **Serving Info** | ❌ No | ✅ Yes (pax, prep time) |
| **Price Deltas** | ❌ No | ✅ Yes (modifier upcharges) |
| **Confidence Scoring** | ✅ Yes | ✅ Yes |
| **Uncertain Items** | ✅ Yes | ✅ Yes |
| **Currency Detection** | ✅ Yes | ✅ Yes |
| **Cost per Extraction** | ~$0.02-0.03 | ~$0.03-0.05 |
| **Availability** | ✅ All users | ✅ All users |

## Stage 1: MVP (Basic Structured Extraction)

### What's Included

Stage 1 provides core menu extraction functionality:

1. **Item Extraction**
   - Item name
   - Single price per item
   - Description (if present)
   - Confidence score

2. **Hierarchical Categories**
   - Top-level categories (e.g., "APPETIZERS", "MAIN COURSES")
   - Nested subcategories (e.g., "PREMIUM STEAKS" → "BIG CUTS")
   - Automatic organization of items into categories

3. **Quality Features**
   - Confidence scoring (0.0 to 1.0)
   - Uncertain items flagged for review
   - Superfluous text detection (decorative elements)
   - Currency auto-detection

4. **Review Interface**
   - Category tree view
   - Inline editing for all fields
   - Uncertain items panel
   - Simple reordering (move up/down)

### When to Use Stage 1

Stage 1 is ideal for:

- **Simple menus** with single prices per item
- **Quick setup** when you don't need variants or modifiers
- **Testing** the extraction system
- **Menus without size options** (e.g., fixed-price items)

### Example: Stage 1 Output

```json
{
  "categories": [
    {
      "name": "APPETIZERS",
      "items": [
        {
          "name": "GARLIC BUTTER TOAST",
          "price": 6,
          "description": "Crispy sourdough with herb butter",
          "confidence": 1.0
        },
        {
          "name": "TRUFFLE FRIES",
          "price": 12,
          "confidence": 0.95
        }
      ],
      "confidence": 1.0
    },
    {
      "name": "MAIN COURSES",
      "subcategories": [
        {
          "name": "STEAKS",
          "items": [
            {
              "name": "RIBEYE STEAK",
              "price": 45,
              "description": "300g premium ribeye",
              "confidence": 1.0
            }
          ],
          "confidence": 1.0
        }
      ],
      "confidence": 1.0
    }
  ],
  "currency": "SGD"
}
```

### Limitations

Stage 1 does **not** support:

- ❌ Multiple sizes/prices per item (e.g., Small $8, Large $12)
- ❌ Modifier groups (e.g., "Choose Your Sauce")
- ❌ Set menus with courses
- ❌ Serving information (e.g., "for 2 pax")
- ❌ Price deltas for add-ons

**Workaround:** Create separate items for each size/variant manually.

---

## Stage 2: Full Schema (Comprehensive Extraction)

### What's Included

Stage 2 extends Stage 1 with advanced features:

1. **Item Variants**
   - Multiple sizes per item (Small, Medium, Large)
   - Different prices for each size
   - Variant attributes (e.g., "500g for 2 pax")
   - Automatic grouping of variants

2. **Modifier Groups**
   - Sauce options (e.g., "Choose Your Sauce")
   - Add-ons (e.g., "Extra Cheese +$3")
   - Price deltas for upcharges
   - Single-select vs multi-select
   - Required vs optional modifiers

3. **Set Menus**
   - Multi-course menus (Starter, Main, Dessert)
   - Choice options per course
   - Price variations and surcharges
   - Combo meals with included items

4. **Additional Information**
   - Serving size (e.g., "for 2 pax")
   - Preparation time (e.g., "15 min")
   - Served with (e.g., "Comes with fries and salad")
   - Special notes

5. **Enhanced Review Interface**
   - Variant editor (add/edit/remove variants)
   - Modifier group editor
   - Set menu editor
   - Bulk price adjustments

### When to Use Stage 2

Stage 2 is ideal for:

- **Complex menus** with multiple sizes and options
- **Restaurants with customization** (sauces, add-ons)
- **Set menus or prix fixe** offerings
- **Detailed menu information** (serving size, prep time)
- **Professional presentations** with full menu details

### Example: Stage 2 Output

```json
{
  "categories": [
    {
      "name": "BURGERS",
      "items": [
        {
          "name": "CLASSIC BURGER",
          "variants": [
            {
              "size": "Single",
              "price": 12
            },
            {
              "size": "Double",
              "price": 18
            }
          ],
          "modifierGroups": [
            {
              "name": "Choose Your Sauce",
              "type": "single",
              "required": true,
              "options": [
                {
                  "name": "BBQ Sauce",
                  "priceDelta": 0
                },
                {
                  "name": "Truffle Mayo",
                  "priceDelta": 3
                }
              ]
            },
            {
              "name": "Add-ons",
              "type": "multi",
              "required": false,
              "options": [
                {
                  "name": "Extra Cheese",
                  "priceDelta": 2
                },
                {
                  "name": "Bacon",
                  "priceDelta": 3
                }
              ]
            }
          ],
          "additional": {
            "servedWith": ["Fries", "Coleslaw"],
            "prepTimeMin": 15
          },
          "confidence": 0.95
        }
      ],
      "confidence": 1.0
    }
  ],
  "currency": "SGD"
}
```

### Advanced Features

1. **Variant Management**
   - Automatically groups items with multiple sizes
   - Prevents duplicate items for each size
   - Unified editing interface
   - Bulk price adjustments (e.g., +10% all variants)

2. **Modifier Intelligence**
   - Detects included vs upcharge options
   - Identifies single-select vs multi-select
   - Extracts price deltas automatically
   - Flags uncertain modifiers for review

3. **Set Menu Handling**
   - Extracts multi-course structure
   - Captures choice options per course
   - Handles price variations (e.g., "+$20 for Wagyu")
   - Supports nested set menu structures

---

## Feature Comparison Details

### 1. Item Variants

**Stage 1:**
- Single price per item
- Multiple sizes require separate items
- Manual creation of size variations

**Stage 2:**
- Multiple variants per item
- Automatic size/price grouping
- Variant attributes (e.g., "for 2 pax")
- Unified variant editor

**Example:**

*Stage 1 Approach:*
```
- PIZZA (Small) - $15
- PIZZA (Medium) - $20
- PIZZA (Large) - $25
```

*Stage 2 Approach:*
```
- PIZZA
  - Small: $15
  - Medium: $20
  - Large: $25
```

### 2. Modifiers and Add-ons

**Stage 1:**
- No modifier support
- Add-ons must be separate items
- No price delta tracking

**Stage 2:**
- Modifier groups with options
- Price deltas for upcharges
- Single/multi-select configuration
- Required/optional settings

**Example:**

*Stage 1 Approach:*
```
- BURGER - $12
- Extra Cheese - $2
- Bacon - $3
```

*Stage 2 Approach:*
```
- BURGER - $12
  Modifiers:
  - Add-ons (multi-select, optional):
    - Extra Cheese (+$2)
    - Bacon (+$3)
```

### 3. Set Menus

**Stage 1:**
- No set menu support
- Must list all items separately
- No course structure

**Stage 2:**
- Multi-course structure
- Choice options per course
- Price variations and surcharges
- Combo meal support

**Example:**

*Stage 1 Approach:*
```
- SET MENU A - $45
  (Soup, Steak, Dessert)
```

*Stage 2 Approach:*
```
- SET MENU A - $45
  Courses:
  - Starter: Soup or Salad
  - Main: Steak or Salmon (+$10)
  - Dessert: Ice Cream or Cake
```

### 4. Additional Information

**Stage 1:**
- Description field only
- No structured serving info
- No preparation time

**Stage 2:**
- Serving size (pax)
- Preparation time
- Served with items
- Special notes

**Example:**

*Stage 1 Approach:*
```
- SHARING PLATTER - $65
  Description: "For 2-3 people, includes fries and salad"
```

*Stage 2 Approach:*
```
- SHARING PLATTER - $65
  For: 2-3 pax
  Served with: Fries, Salad
  Prep time: 20 min
```

---

## Migration Between Stages

### Stage 1 → Stage 2

**Automatic Compatibility:**
- Stage 1 data works with Stage 2 system
- No migration required
- Can upgrade individual menus to Stage 2

**Manual Enhancement:**
- Add variants to existing items
- Create modifier groups
- Convert to set menus if applicable
- Add serving information

**Process:**
1. Open existing menu in editor
2. Enable Stage 2 features
3. Add variants/modifiers as needed
4. Save and publish

### Stage 2 → Stage 1

**Downgrade Process:**
- Variants become separate items
- Modifiers become separate items or removed
- Set menus become flat item lists
- Additional info moved to description

**When to Downgrade:**
- Simplify complex menu
- Reduce extraction cost
- Remove unused features

---

## Cost Comparison

### Stage 1 Costs

- **Average cost:** $0.02-0.03 per extraction
- **Token usage:** ~1,500-2,500 tokens
- **Processing time:** 10-20 seconds
- **Best for:** Simple menus, budget-conscious users

### Stage 2 Costs

- **Average cost:** $0.03-0.05 per extraction
- **Token usage:** ~2,500-4,000 tokens
- **Processing time:** 15-30 seconds
- **Best for:** Complex menus, professional presentations

### Cost Optimization Tips

1. **Use Stage 1 when possible**
   - If you don't need variants/modifiers
   - For simple menu structures
   - When testing extraction

2. **Use Stage 2 selectively**
   - Only for menus that need advanced features
   - When variants/modifiers are essential
   - For customer-facing professional menus

3. **Hybrid Approach**
   - Use Stage 1 for initial extraction
   - Manually add variants/modifiers if needed
   - Upgrade to Stage 2 only when necessary

---

## Accuracy Comparison

### Stage 1 Accuracy

- **Name/Price/Category:** ≥90%
- **Hierarchical structure:** ≥85%
- **Confidence scoring:** ≥85%
- **Review time:** ≤90 seconds

### Stage 2 Accuracy

- **Basic fields:** ≥90% (same as Stage 1)
- **Variants:** ≥85%
- **Modifiers:** ≥80%
- **Set menus:** ≥75%
- **Review time:** ≤120 seconds

### Factors Affecting Accuracy

Both stages:
- Photo quality (lighting, focus, glare)
- Menu layout (simple vs complex)
- Font readability
- Language clarity

Stage 2 additional factors:
- Variant formatting consistency
- Modifier section clarity
- Set menu structure complexity

---

## Choosing the Right Stage

### Use Stage 1 If:

✅ Your menu has single prices per item  
✅ You don't offer size options  
✅ You don't have modifier groups  
✅ You want fastest/cheapest extraction  
✅ You're testing the system  
✅ You prefer manual control over variants  

### Use Stage 2 If:

✅ Your menu has multiple sizes/prices  
✅ You offer customization (sauces, add-ons)  
✅ You have set menus or prix fixe  
✅ You want professional presentation  
✅ You need serving size information  
✅ You want automatic variant grouping  

### Not Sure?

**Start with Stage 1:**
- Extract menu with Stage 1
- Review results
- Manually add variants/modifiers if needed
- Upgrade to Stage 2 for future extractions if beneficial

**Try Both:**
- Extract same menu with both stages
- Compare results and review time
- Choose based on your needs

---

## Frequently Asked Questions

### Can I switch between stages?

Yes! You can:
- Extract with Stage 1, then manually enhance
- Re-extract with Stage 2 if needed
- Use different stages for different menus
- Upgrade existing menus to Stage 2

### Will Stage 1 be deprecated?

No. Stage 1 remains available as:
- Cost-effective option
- Simpler extraction for basic menus
- Fallback if Stage 2 has issues
- User preference option

### Can I use both stages?

Yes! You can:
- Use Stage 1 for some menus
- Use Stage 2 for others
- Choose per extraction
- Mix and match based on menu complexity

### Which stage is default?

- **Current default:** Stage 1 (MVP)
- **Future:** May change to Stage 2 as default
- **User control:** Can select preferred stage
- **Recommendation:** System suggests based on menu

### How do I know which stage was used?

Check extraction metadata:
- Schema version shown in review interface
- Extraction history shows stage used
- Menu data includes schema version
- Admin dashboard tracks stage usage

### Can I force a specific stage?

Yes:
- Select stage before extraction
- Set default stage in preferences
- Override per extraction
- Admin can set organization default

---

## Summary

| Aspect | Stage 1 | Stage 2 |
|--------|---------|---------|
| **Complexity** | Simple | Advanced |
| **Features** | Basic | Comprehensive |
| **Cost** | Lower | Higher |
| **Accuracy** | High | Very High |
| **Review Time** | Shorter | Longer |
| **Best For** | Simple menus | Complex menus |
| **Availability** | All users | All users |
| **Recommendation** | Start here | Upgrade if needed |

**Bottom Line:**
- Start with Stage 1 for most menus
- Upgrade to Stage 2 when you need variants, modifiers, or set menus
- Both stages are available to all users
- Choose based on your menu complexity and needs

---

## Need Help Deciding?

Contact support with:
- Sample menu photo
- Description of menu structure
- Your goals (speed vs features)
- Budget considerations

We'll recommend the best stage for your needs!
