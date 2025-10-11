/**
 * Fit Engine
 * 
 * Pure, deterministic content fitting engine that applies overflow policies
 * to ensure menu content fits within template constraints.
 * 
 * Key principles:
 * - Pure functions with no global state
 * - Deterministic: same inputs always produce same outputs
 * - Applies policies in order until content fits
 * - Respects accessibility constraints (minimum font sizes, contrast)
 */

import type { TemplateDescriptor, OverflowPolicy } from '../templates/types';
import type { MenuItem } from '../../types';

/**
 * CSS properties to apply for a policy
 */
export interface PolicyStyles {
  /** CSS properties to apply */
  css: Record<string, string | number>;
  /** Description of what this policy does */
  description: string;
}

/**
 * Result of the fit engine operation
 */
export interface FitResult {
  /** Whether content was successfully fitted */
  success: boolean;
  /** Policies that were applied to achieve fit */
  appliedPolicies: OverflowPolicy[];
  /** CSS styles to apply for each policy */
  policyStyles: Partial<Record<OverflowPolicy, PolicyStyles>>;
  /** Final font sizes after adjustments */
  finalFontSizes: {
    heading: number;
    body: number;
    price: number;
  };
  /** Number of pages in the output */
  pageCount: number;
  /** Warnings generated during fitting */
  warnings: string[];
  /** Pagination points (item indices where page breaks occur) */
  paginationPoints?: number[];
}

/**
 * Options for the fit engine
 */
export interface FitOptions {
  /** Target format (affects accessibility requirements) */
  format: 'web' | 'print';
  /** Maximum number of policy iterations to attempt */
  maxIterations?: number;
  /** Custom overflow threshold in pixels */
  overflowThreshold?: number;
}

/**
 * Measured metrics for content overflow detection
 */
export interface ContentMetrics {
  /** Total content height in pixels */
  contentHeight: number;
  /** Available height in pixels */
  availableHeight: number;
  /** Overflow amount in pixels (0 if no overflow) */
  overflow: number;
  /** Number of items in the content */
  itemCount: number;
}

/**
 * Pure, deterministic fit engine
 * 
 * This class applies overflow policies to menu content to ensure it fits
 * within template constraints. All methods are pure functions that don't
 * modify external state.
 */
export class FitEngine {
  private descriptor: TemplateDescriptor;
  private options: Required<FitOptions>;

  constructor(descriptor: TemplateDescriptor, options: FitOptions = { format: 'print' }) {
    this.descriptor = descriptor;
    this.options = {
      format: options.format,
      maxIterations: options.maxIterations ?? 10,
      overflowThreshold: options.overflowThreshold ?? 0,
    };
  }

  /**
   * Fit content by applying overflow policies
   * 
   * This is the main entry point for the fit engine. It orchestrates
   * the application of policies until content fits or all policies
   * are exhausted.
   * 
   * @param items Menu items to fit
   * @param categories Category groupings
   * @param metrics Measured content metrics
   * @returns Fit result with applied policies and warnings
   */
  async fitContent(
    items: MenuItem[],
    categories: string[],
    metrics: ContentMetrics
  ): Promise<FitResult> {
    const warnings: string[] = [];
    const appliedPolicies: OverflowPolicy[] = [];
    const policyStyles: Partial<Record<OverflowPolicy, PolicyStyles>> = {};
    
    // Start with default font sizes from template
    let currentFontSizes = {
      heading: this.descriptor.fonts.heading.max,
      body: this.descriptor.fonts.body.max,
      price: this.descriptor.fonts.price.max,
    };

    let currentMetrics = { ...metrics };
    let pageCount = 1;
    let paginationPoints: number[] | undefined;

    // If content already fits, return success immediately
    if (currentMetrics.overflow <= this.options.overflowThreshold) {
      return {
        success: true,
        appliedPolicies: [],
        policyStyles: {},
        finalFontSizes: currentFontSizes,
        pageCount: 1,
        warnings: [],
      };
    }

    // Apply policies in order from template descriptor
    for (const policy of this.descriptor.overflowPolicies) {
      if (appliedPolicies.length >= this.options.maxIterations) {
        warnings.push(`Maximum iterations (${this.options.maxIterations}) reached`);
        break;
      }

      // Apply the policy and get updated metrics
      const policyResult = await this.applyPolicy(
        policy,
        items,
        categories,
        currentMetrics,
        currentFontSizes
      );

      if (policyResult.applied) {
        appliedPolicies.push(policy);
        currentMetrics = policyResult.metrics;
        currentFontSizes = policyResult.fontSizes;
        
        // Store the policy styles for the renderer
        if (policyResult.styles) {
          policyStyles[policy] = policyResult.styles;
        }
        
        if (policyResult.pageCount) {
          pageCount = policyResult.pageCount;
        }
        
        if (policyResult.paginationPoints) {
          paginationPoints = policyResult.paginationPoints;
        }

        // Add any warnings from this policy
        if (policyResult.warnings) {
          warnings.push(...policyResult.warnings);
        }

        // Check if content now fits
        if (currentMetrics.overflow <= this.options.overflowThreshold) {
          return {
            success: true,
            appliedPolicies,
            policyStyles,
            finalFontSizes: currentFontSizes,
            pageCount,
            warnings,
            paginationPoints,
          };
        }
      }
    }

    // All policies exhausted but content still doesn't fit
    warnings.push(
      `Content still overflows by ${currentMetrics.overflow}px after applying all policies. ` +
      `Consider reducing content or adjusting template constraints.`
    );

    return {
      success: false,
      appliedPolicies,
      policyStyles,
      finalFontSizes: currentFontSizes,
      pageCount,
      warnings,
      paginationPoints,
    };
  }

  /**
   * Apply a single overflow policy
   */
  private async applyPolicy(
    policy: OverflowPolicy,
    items: MenuItem[],
    categories: string[],
    metrics: ContentMetrics,
    fontSizes: FitResult['finalFontSizes']
  ): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles?: PolicyStyles;
    pageCount?: number;
    paginationPoints?: number[];
    warnings?: string[];
  }> {
    switch (policy) {
      case 'wrap':
        return this.applyWrap(metrics);
      
      case 'compact':
        return this.applyCompact(metrics);
      
      case 'reflow':
        return this.applyReflow(metrics, this.descriptor.canvas.cols);
      
      case 'paginate':
        return this.applyPaginate(items, categories, metrics);
      
      case 'shrink':
        return this.applyShrink(metrics, fontSizes);
      
      default:
        return {
          applied: false,
          metrics,
          fontSizes,
        };
    }
  }

  /**
   * Apply wrap policy: enable hyphenation and text wrapping
   * 
   * This policy enables CSS hyphenation and word wrapping to allow
   * text to flow more naturally and reduce overflow.
   * 
   * Requirements: 5.4, 6.2
   */
  private applyWrap(metrics: ContentMetrics): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles: PolicyStyles;
  }> {
    // Wrapping typically reduces overflow by ~5-10% for English text
    // This is a conservative estimate for deterministic behavior
    const reductionFactor = 0.07; // 7% reduction
    const newOverflow = Math.max(0, metrics.overflow * (1 - reductionFactor));

    return Promise.resolve({
      applied: true,
      metrics: {
        ...metrics,
        overflow: newOverflow,
        contentHeight: metrics.availableHeight + newOverflow,
      },
      fontSizes: {
        heading: this.descriptor.fonts.heading.max,
        body: this.descriptor.fonts.body.max,
        price: this.descriptor.fonts.price.max,
      },
      styles: {
        css: {
          'hyphens': 'auto',
          'word-wrap': 'break-word',
          'overflow-wrap': 'break-word',
          '-webkit-hyphens': 'auto',
          '-ms-hyphens': 'auto',
        },
        description: 'Enable hyphenation and text wrapping for better text flow',
      },
    });
  }

  /**
   * Apply compact policy: reduce spacing and line-height
   * 
   * This policy reduces vertical padding by 20% and line-height by 0.06
   * to create a more compact layout.
   * 
   * Requirements: 6.3
   */
  private applyCompact(metrics: ContentMetrics): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles: PolicyStyles;
  }> {
    // Compact reduces spacing by 20% and line-height by 0.06
    // Estimate ~12-15% height reduction
    const reductionFactor = 0.13; // 13% reduction
    const newOverflow = Math.max(0, metrics.overflow * (1 - reductionFactor));

    // Calculate reduced padding (80% of original)
    const paddingReduction = 0.8;

    return Promise.resolve({
      applied: true,
      metrics: {
        ...metrics,
        overflow: newOverflow,
        contentHeight: metrics.availableHeight + newOverflow,
      },
      fontSizes: {
        heading: this.descriptor.fonts.heading.max,
        body: this.descriptor.fonts.body.max,
        price: this.descriptor.fonts.price.max,
      },
      styles: {
        css: {
          'padding-top': `calc(var(--padding-top, 1rem) * ${paddingReduction})`,
          'padding-bottom': `calc(var(--padding-bottom, 1rem) * ${paddingReduction})`,
          'margin-top': `calc(var(--margin-top, 0.5rem) * ${paddingReduction})`,
          'margin-bottom': `calc(var(--margin-bottom, 0.5rem) * ${paddingReduction})`,
          'line-height': 'calc(var(--line-height, 1.5) - 0.06)',
        },
        description: 'Reduce vertical spacing by 20% and line-height by 0.06',
      },
    });
  }

  /**
   * Apply reflow policy: convert multi-column to single column
   * 
   * This policy converts multi-column layouts to single column,
   * which can help with very long content by improving distribution.
   * 
   * Requirements: 6.4
   */
  private applyReflow(
    metrics: ContentMetrics,
    currentCols: number
  ): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles?: PolicyStyles;
  }> {
    // Only apply if we have multiple columns
    if (currentCols <= 1) {
      return Promise.resolve({
        applied: false,
        metrics,
        fontSizes: {
          heading: this.descriptor.fonts.heading.max,
          body: this.descriptor.fonts.body.max,
          price: this.descriptor.fonts.price.max,
        },
      });
    }

    // Reflow to single column typically increases height but improves readability
    // For overflow purposes, this helps when content is unevenly distributed
    // Estimate ~10% reduction in overflow due to better distribution
    const reductionFactor = 0.10;
    const newOverflow = Math.max(0, metrics.overflow * (1 - reductionFactor));

    return Promise.resolve({
      applied: true,
      metrics: {
        ...metrics,
        overflow: newOverflow,
        contentHeight: metrics.availableHeight + newOverflow,
      },
      fontSizes: {
        heading: this.descriptor.fonts.heading.max,
        body: this.descriptor.fonts.body.max,
        price: this.descriptor.fonts.price.max,
      },
      styles: {
        css: {
          'column-count': 1,
          'columns': 1,
          '-webkit-column-count': 1,
          '-moz-column-count': 1,
          'display': 'block',
        },
        description: 'Convert multi-column layout to single column for better content distribution',
      },
    });
  }

  /**
   * Apply paginate policy: create multiple pages
   * 
   * This policy splits content across multiple pages, keeping section
   * headers with their first item to avoid orphans.
   * 
   * Requirements: 6.5
   */
  private applyPaginate(
    items: MenuItem[],
    categories: string[],
    metrics: ContentMetrics
  ): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles: PolicyStyles;
    pageCount: number;
    paginationPoints: number[];
  }> {
    // Calculate how many pages we need based on overflow
    const pageHeight = metrics.availableHeight;
    const totalHeight = metrics.contentHeight;
    const pagesNeeded = Math.ceil(totalHeight / pageHeight);

    // Calculate pagination points (item indices where page breaks occur)
    // Keep section headers with their first item to avoid orphans
    const itemsPerPage = Math.ceil(items.length / pagesNeeded);
    const paginationPoints: number[] = [];
    
    // Group items by category to avoid breaking sections
    let currentPage = 0;
    let itemsOnCurrentPage = 0;
    
    for (let i = 0; i < items.length; i++) {
      itemsOnCurrentPage++;
      
      // Check if we should start a new page
      if (itemsOnCurrentPage >= itemsPerPage && i < items.length - 1) {
        // Look ahead to see if next item is in a new category
        const currentCategory = items[i].category;
        const nextCategory = items[i + 1]?.category;
        
        // Only break if we're not in the middle of a category
        if (currentCategory !== nextCategory) {
          paginationPoints.push(i + 1);
          currentPage++;
          itemsOnCurrentPage = 0;
        }
      }
    }

    return Promise.resolve({
      applied: true,
      metrics: {
        ...metrics,
        overflow: 0, // Pagination resolves all overflow
        contentHeight: pageHeight * pagesNeeded,
      },
      fontSizes: {
        heading: this.descriptor.fonts.heading.max,
        body: this.descriptor.fonts.body.max,
        price: this.descriptor.fonts.price.max,
      },
      styles: {
        css: {
          'page-break-inside': 'avoid',
          'break-inside': 'avoid',
          'page-break-after': 'auto',
          'break-after': 'auto',
        },
        description: `Split content across ${pagesNeeded} pages, keeping section headers with their items`,
      },
      pageCount: pagesNeeded,
      paginationPoints,
    });
  }

  /**
   * Apply shrink policy: reduce font sizes within accessibility constraints
   * 
   * This policy reduces font sizes within the template's min/max ranges,
   * respecting accessibility floors. It will never go below the minimum
   * font size specified in the template.
   * 
   * Body fonts: ±1.5px adjustment
   * Heading fonts: ±2px adjustment
   * 
   * Accessibility enforcement:
   * - Print: minBodyPx from template (typically 13px)
   * - Web: max(minBodyPx, 14px) for better readability
   * - Surfaces warnings when approaching limits
   * - Fails with error if content still doesn't fit at minimum sizes
   * 
   * Requirements: 6.6
   */
  private applyShrink(
    metrics: ContentMetrics,
    currentFontSizes: FitResult['finalFontSizes']
  ): Promise<{
    applied: boolean;
    metrics: ContentMetrics;
    fontSizes: FitResult['finalFontSizes'];
    styles?: PolicyStyles;
    warnings?: string[];
  }> {
    const warnings: string[] = [];
    
    // Calculate new font sizes with adjustments
    // Body: ±1.5px, Headings: ±2px (as per requirements)
    const bodyAdjustment = 1.5;
    const headingAdjustment = 2.0;
    
    // Get accessibility floor based on format
    const accessibilityFloor = this.options.format === 'print' 
      ? this.descriptor.accessibility.minBodyPx 
      : Math.max(this.descriptor.accessibility.minBodyPx, 14); // Web requires 14px minimum
    
    // Calculate new sizes, respecting both template min and accessibility floor
    const effectiveBodyMin = Math.max(this.descriptor.fonts.body.min, accessibilityFloor);
    const effectiveHeadingMin = Math.max(this.descriptor.fonts.heading.min, accessibilityFloor);
    const effectivePriceMin = Math.max(this.descriptor.fonts.price.min, accessibilityFloor);
    
    const newBodySize = Math.max(
      effectiveBodyMin,
      currentFontSizes.body - bodyAdjustment
    );
    
    const newHeadingSize = Math.max(
      effectiveHeadingMin,
      currentFontSizes.heading - headingAdjustment
    );
    
    const newPriceSize = Math.max(
      effectivePriceMin,
      currentFontSizes.price - bodyAdjustment
    );

    // Surface warnings when approaching accessibility limits
    const warningThreshold = accessibilityFloor + 1; // Warn when within 1px of floor
    
    if (newBodySize <= warningThreshold) {
      warnings.push(
        `Body font size (${newBodySize}px) is approaching accessibility floor (${accessibilityFloor}px for ${this.options.format}). ` +
        `Consider reducing content length.`
      );
    }
    
    if (newHeadingSize <= warningThreshold) {
      warnings.push(
        `Heading font size (${newHeadingSize}px) is approaching accessibility floor (${accessibilityFloor}px for ${this.options.format}).`
      );
    }

    // Check if we hit the absolute floor
    if (newBodySize <= accessibilityFloor) {
      warnings.push(
        `ACCESSIBILITY VIOLATION: Body font size (${newBodySize}px) is at accessibility floor (${accessibilityFloor}px). ` +
        `Cannot shrink further without violating accessibility requirements.`
      );
    }

    // Check if we actually reduced the font sizes
    const sizeReduced = 
      newBodySize < currentFontSizes.body ||
      newHeadingSize < currentFontSizes.heading ||
      newPriceSize < currentFontSizes.price;

    if (!sizeReduced) {
      return Promise.resolve({
        applied: false,
        metrics,
        fontSizes: currentFontSizes,
        warnings: ['Cannot shrink fonts further - already at minimum sizes (accessibility floor enforced)'],
      });
    }

    // Estimate overflow reduction based on font size reduction
    // Smaller fonts typically reduce height by ~8-12% per 1.5px reduction
    const avgReduction = (
      (currentFontSizes.body - newBodySize) +
      (currentFontSizes.heading - newHeadingSize) +
      (currentFontSizes.price - newPriceSize)
    ) / 3;
    
    const reductionFactor = Math.min(0.15, avgReduction * 0.08); // Cap at 15% reduction
    const newOverflow = Math.max(0, metrics.overflow * (1 - reductionFactor));

    return Promise.resolve({
      applied: true,
      metrics: {
        ...metrics,
        overflow: newOverflow,
        contentHeight: metrics.availableHeight + newOverflow,
      },
      fontSizes: {
        heading: newHeadingSize,
        body: newBodySize,
        price: newPriceSize,
      },
      styles: {
        css: {
          '--heading-font-size': `${newHeadingSize}px`,
          '--body-font-size': `${newBodySize}px`,
          '--price-font-size': `${newPriceSize}px`,
          'font-size': `${newBodySize}px`,
        },
        description: `Reduce font sizes (body: ${newBodySize}px, heading: ${newHeadingSize}px, price: ${newPriceSize}px) within accessibility constraints`,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  /**
   * Measure overflow for given content metrics
   * 
   * This is a helper method that can be used to measure overflow
   * from actual DOM elements in the renderer.
   */
  static measureOverflow(
    contentHeight: number,
    availableHeight: number
  ): number {
    return Math.max(0, contentHeight - availableHeight);
  }

  /**
   * Calculate content metrics from DOM element
   * 
   * This helper can be used by the renderer to get metrics from
   * actual rendered content.
   */
  static calculateMetrics(
    element: { scrollHeight: number; clientHeight: number },
    itemCount: number
  ): ContentMetrics {
    const contentHeight = element.scrollHeight;
    const availableHeight = element.clientHeight;
    const overflow = FitEngine.measureOverflow(contentHeight, availableHeight);

    return {
      contentHeight,
      availableHeight,
      overflow,
      itemCount,
    };
  }
}
