/**
 * Menu Renderer
 * 
 * Renders menu data to HTML/CSS using template descriptors.
 * Generates complete, self-contained HTML documents with embedded styles.
 * 
 * Key features:
 * - Locale-aware rendering with proper lang attributes
 * - Template-based styling with font fallbacks
 * - Responsive layout with multi-column support
 * - Accessibility-compliant markup
 * - Optional bleed/safe area markers for print
 */

import type { TemplateDescriptor, OverflowPolicy } from '../templates/types';
import type { Menu, MenuItem, RenderMetadata } from '../../types';
import { FitEngine, type FitResult, type ContentMetrics } from './fit-engine';
import { JSDOM } from 'jsdom';

/**
 * Render options for menu rendering
 */
export interface RenderOptions {
  /** Template descriptor to use for rendering */
  template: TemplateDescriptor;
  /** Menu data to render */
  menu: Menu;
  /** Optional background image URL */
  backgroundUrl?: string;
  /** Target format (affects accessibility requirements) */
  format: 'web' | 'print';
  /** Locale for hyphenation and formatting (default: 'en-GB') */
  locale?: string;
  /** Show bleed and safe area markers (dev mode only) */
  showBleedMarkers?: boolean;
  /** Applied fit policies from fit engine (for pre-fitted content) */
  appliedPolicies?: Array<{
    policy: string;
    styles: Record<string, string | number>;
  }>;
  /** Final font sizes from fit engine (for pre-fitted content) */
  finalFontSizes?: {
    heading: number;
    body: number;
    price: number;
  };
  /** Whether to apply fit engine (default: true) */
  applyFitEngine?: boolean;
  /** Existing render metadata for reproducible exports */
  existingMetadata?: RenderMetadata;
}

/**
 * Result of rendering with fit engine
 */
export interface RenderResult {
  /** Final rendered HTML */
  html: string;
  /** Render metadata for reproducible exports */
  metadata: RenderMetadata;
  /** Whether content was successfully fitted */
  success: boolean;
}

/**
 * Menu Renderer class
 * 
 * Renders menu data to HTML/CSS based on template descriptors.
 * Produces complete, self-contained HTML documents ready for export.
 */
export class MenuRenderer {
  private options: Required<Omit<RenderOptions, 'backgroundUrl' | 'showBleedMarkers' | 'appliedPolicies' | 'finalFontSizes' | 'existingMetadata'>> & 
    Pick<RenderOptions, 'backgroundUrl' | 'showBleedMarkers' | 'appliedPolicies' | 'finalFontSizes' | 'existingMetadata'>;

  constructor(options: RenderOptions) {
    this.options = {
      template: options.template,
      menu: options.menu,
      format: options.format,
      locale: options.locale || 'en-GB',
      applyFitEngine: options.applyFitEngine ?? true,
      backgroundUrl: options.backgroundUrl,
      showBleedMarkers: options.showBleedMarkers,
      appliedPolicies: options.appliedPolicies,
      finalFontSizes: options.finalFontSizes,
      existingMetadata: options.existingMetadata,
    };
  }

  /**
   * Render menu to complete HTML document with fit engine integration
   * 
   * Generates a self-contained HTML document with embedded styles,
   * proper locale settings, and all menu content. Optionally applies
   * fit engine to ensure content fits within template constraints.
   * 
   * Requirements: 5.1, 5.2, 5.3, 10.2, 10.3, 6.1, 6.7, 11.3
   */
  async renderToHTML(): Promise<string> {
    const result = await this.renderWithFitEngine();
    return result.html;
  }

  /**
   * Render menu with fit engine integration
   * 
   * This method orchestrates the rendering process with the fit engine:
   * 1. Generate initial HTML
   * 2. Measure content overflow
   * 3. Apply fit policies iteratively
   * 4. Generate final HTML with applied policies
   * 5. Return HTML with metadata
   * 
   * Requirements: 6.1, 6.7, 11.3
   */
  async renderWithFitEngine(): Promise<RenderResult> {
    const { template, menu, format, applyFitEngine = true, existingMetadata } = this.options;

    // If we have existing metadata and don't want to re-fit, use it directly
    if (existingMetadata && !applyFitEngine) {
      this.options.appliedPolicies = existingMetadata.appliedPolicies?.map(policy => ({
        policy,
        styles: {},
      }));
      this.options.finalFontSizes = existingMetadata.finalFontSizes;
      
      const html = await this.generateHTML();
      return {
        html,
        metadata: existingMetadata,
        success: true,
      };
    }

    // If fit engine is disabled, just render without fitting
    if (!applyFitEngine) {
      const html = await this.generateHTML();
      return {
        html,
        metadata: {
          appliedPolicies: [],
          warnings: [],
          pageCount: 1,
        },
        success: true,
      };
    }

    // Step 1: Generate initial HTML without fit policies
    const initialHTML = await this.generateHTML();

    // Step 2: Measure content overflow using JSDOM
    const metrics = await this.measureContent(initialHTML);

    // Step 3: Apply fit engine
    const fitEngine = new FitEngine(template, { format });
    const categories = Array.from(this.groupItemsByCategory(menu.items).keys());
    const fitResult = await fitEngine.fitContent(menu.items, categories, metrics);

    // Step 4: Update options with fit results
    this.options.appliedPolicies = Object.entries(fitResult.policyStyles).map(([policy, styles]) => ({
      policy,
      styles: styles.css,
    }));
    this.options.finalFontSizes = fitResult.finalFontSizes;

    // Step 5: Generate final HTML with applied policies
    const finalHTML = await this.generateHTML();

    // Step 6: Build render metadata
    const metadata: RenderMetadata = {
      appliedPolicies: fitResult.appliedPolicies,
      paginationPoints: fitResult.paginationPoints,
      warnings: fitResult.warnings,
      finalFontSizes: fitResult.finalFontSizes,
      pageCount: fitResult.pageCount,
    };

    return {
      html: finalHTML,
      metadata,
      success: fitResult.success,
    };
  }

  /**
   * Generate HTML without fit engine (internal method)
   * 
   * This is the core HTML generation logic that can be called
   * multiple times during the fit process.
   */
  private async generateHTML(): Promise<string> {
    const { template, menu, locale, backgroundUrl, showBleedMarkers } = this.options;
    
    // Group items by category
    const itemsByCategory = this.groupItemsByCategory(menu.items);
    
    // Generate HTML structure
    const html = `<!DOCTYPE html>
<html lang="${this.escapeHtml(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(menu.name)}</title>
  ${this.renderFontLinks()}
  ${this.renderStyles()}
</head>
<body>
  ${showBleedMarkers ? this.renderBleedMarkers() : ''}
  <div class="menu-container">
    ${this.renderHeader()}
    <div class="menu-content">
      ${Array.from(itemsByCategory.entries())
        .map(([category, items]) => this.renderSection(category, items))
        .join('\n')}
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Measure content overflow using JSDOM
   * 
   * This method creates a virtual DOM from the HTML and measures
   * the content height vs available height to detect overflow.
   * 
   * Requirements: 6.1, 11.3
   */
  private async measureContent(html: string): Promise<ContentMetrics> {
    const { template, menu } = this.options;

    // Create a virtual DOM
    const dom = new JSDOM(html, {
      resources: 'usable',
      runScripts: 'outside-only',
    });

    const document = dom.window.document;

    // Wait for fonts to load (simulate)
    // In a real browser, we'd wait for document.fonts.ready
    // For JSDOM, we'll use a timeout to simulate font loading
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the menu content container
    const contentElement = document.querySelector('.menu-content');
    
    if (!contentElement) {
      // Fallback if element not found
      return {
        contentHeight: 0,
        availableHeight: 1000, // Default page height
        overflow: 0,
        itemCount: menu.items.length,
      };
    }

    // Calculate available height based on template canvas config
    // A4 at 300 DPI: 210mm x 297mm = 2480px x 3508px
    // A3 at 300 DPI: 297mm x 420mm = 3508px x 4961px
    const dpi = template.canvas.dpi;
    const mmToPx = (mm: number) => (mm * dpi) / 25.4;
    
    const pageHeight = template.canvas.size === 'A4' 
      ? mmToPx(297) 
      : mmToPx(420);
    
    const availableHeight = pageHeight - template.canvas.margins.top - template.canvas.margins.bottom;

    // Measure content height
    // Note: JSDOM doesn't fully support layout, so we'll estimate based on content
    // In a real implementation with Playwright, we'd use actual measurements
    const contentHeight = this.estimateContentHeight(menu.items, template);

    const overflow = FitEngine.measureOverflow(contentHeight, availableHeight);

    // Clean up
    dom.window.close();

    return {
      contentHeight,
      availableHeight,
      overflow,
      itemCount: menu.items.length,
    };
  }

  /**
   * Estimate content height based on menu items and template
   * 
   * This is a heuristic estimation since JSDOM doesn't fully support layout.
   * In production with Playwright, we'd use actual DOM measurements.
   */
  private estimateContentHeight(items: MenuItem[], template: TemplateDescriptor): number {
    const { finalFontSizes } = this.options;
    
    // Use final font sizes if available, otherwise use template max
    const bodySize = finalFontSizes?.body || template.fonts.body.max;
    const headingSize = finalFontSizes?.heading || template.fonts.heading.max;
    
    // Estimate height per item
    // Item name: 1 line at body size
    // Item description: ~2-3 lines at 0.9 * body size
    // Spacing: ~1.5rem between items
    const lineHeight = 1.5;
    const itemNameHeight = bodySize * lineHeight;
    const itemDescHeight = bodySize * 0.9 * lineHeight * 2.5; // Average 2.5 lines
    const itemSpacing = 24; // 1.5rem in pixels
    const itemHeight = itemNameHeight + itemDescHeight + itemSpacing;
    
    // Estimate section header height
    const sectionHeaderHeight = headingSize * lineHeight + 32; // Header + spacing
    
    // Count sections
    const categories = new Set(items.map(item => item.category || 'Uncategorized'));
    const sectionCount = categories.size;
    
    // Total height estimate
    const totalHeight = 
      (sectionCount * sectionHeaderHeight) + 
      (items.length * itemHeight) +
      100; // Header and padding
    
    return totalHeight;
  }

  /**
   * Group menu items by category
   */
  private groupItemsByCategory(items: MenuItem[]): Map<string, MenuItem[]> {
    const grouped = new Map<string, MenuItem[]>();
    
    // Sort items by order first
    const sortedItems = [...items].sort((a, b) => a.order - b.order);
    
    for (const item of sortedItems) {
      const category = item.category || 'Uncategorized';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    }
    
    return grouped;
  }

  /**
   * Render Google Fonts link tags
   */
  private renderFontLinks(): string {
    const { template } = this.options;
    const fonts = new Set<string>();
    
    // Collect unique font families with weights
    const addFont = (spec: typeof template.fonts.heading) => {
      const weight = spec.weight || 400;
      fonts.add(`${spec.family}:wght@${weight}`);
    };
    
    addFont(template.fonts.heading);
    addFont(template.fonts.body);
    addFont(template.fonts.price);
    
    // Add Noto Sans as fallback for CJK and special characters
    fonts.add('Noto+Sans:wght@400;700');
    
    const fontParams = Array.from(fonts).join('&family=');
    
    return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${fontParams}&display=swap" rel="stylesheet">`;
  }

  /**
   * Render embedded CSS styles
   */
  private renderStyles(): string {
    const { template, backgroundUrl, finalFontSizes, appliedPolicies } = this.options;
    
    // Use final font sizes from fit engine if available, otherwise use template max
    const headingSize = finalFontSizes?.heading || template.fonts.heading.max;
    const bodySize = finalFontSizes?.body || template.fonts.body.max;
    const priceSize = finalFontSizes?.price || template.fonts.price.max;
    
    // Calculate page dimensions based on canvas config
    const pageWidth = template.canvas.size === 'A4' ? 210 : 297; // mm
    const pageHeight = template.canvas.size === 'A4' ? 297 : 420; // mm
    
    // Convert margins from pixels to mm (assuming 96 DPI for CSS)
    const pxToMm = (px: number) => (px * 25.4) / 96;
    
    const marginTop = pxToMm(template.canvas.margins.top);
    const marginRight = pxToMm(template.canvas.margins.right);
    const marginBottom = pxToMm(template.canvas.margins.bottom);
    const marginLeft = pxToMm(template.canvas.margins.left);
    
    // Build font family stacks with fallbacks
    const headingFontStack = `'${template.fonts.heading.family}', 'Noto Sans', sans-serif`;
    const bodyFontStack = `'${template.fonts.body.family}', 'Noto Sans', sans-serif`;
    const priceFontStack = `'${template.fonts.price.family}', 'Noto Sans', sans-serif`;
    
    // Collect policy styles
    let policyCSS = '';
    if (appliedPolicies) {
      for (const { policy, styles } of appliedPolicies) {
        const cssProps = Object.entries(styles)
          .map(([key, value]) => `  ${key}: ${value};`)
          .join('\n');
        policyCSS += `\n/* Policy: ${policy} */\n${cssProps}\n`;
      }
    }
    
    return `<style>
    /* CSS Reset and Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    :root {
      --heading-font-size: ${headingSize}px;
      --body-font-size: ${bodySize}px;
      --price-font-size: ${priceSize}px;
      --padding-top: 1rem;
      --padding-bottom: 1rem;
      --margin-top: 0.5rem;
      --margin-bottom: 0.5rem;
      --line-height: 1.5;
    }
    
    html {
      font-size: 16px;
    }
    
    body {
      font-family: ${bodyFontStack};
      font-size: var(--body-font-size);
      line-height: var(--line-height);
      color: #1a1a1a;
      ${backgroundUrl ? `background-image: url('${backgroundUrl}');` : `background-color: ${template.layers.background.color || '#ffffff'};`}
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
    
    /* Page Setup for Print */
    @page {
      size: ${template.canvas.size};
      margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
    }
    
    /* Menu Container */
    .menu-container {
      max-width: ${pageWidth}mm;
      margin: 0 auto;
      padding: ${template.canvas.margins.top}px ${template.canvas.margins.right}px ${template.canvas.margins.bottom}px ${template.canvas.margins.left}px;
    }
    
    /* Header Styles */
    .menu-header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #333;
    }
    
    .menu-title {
      font-family: ${headingFontStack};
      font-size: calc(var(--heading-font-size) * 1.5);
      font-weight: ${template.fonts.heading.weight || 700};
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    /* Content Layout */
    .menu-content {
      column-count: ${template.canvas.cols};
      column-gap: ${template.canvas.gutter}px;
      column-fill: balance;
    }
    
    /* Section Styles */
    .menu-section {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: var(--margin-bottom);
    }
    
    .section-title {
      font-family: ${headingFontStack};
      font-size: var(--heading-font-size);
      font-weight: ${template.fonts.heading.weight || 700};
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #666;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    /* Menu Item Styles */
    .menu-item {
      margin-bottom: 1.5rem;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .menu-item.unavailable {
      opacity: 0.5;
    }
    
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.25rem;
    }
    
    .item-name {
      font-family: ${bodyFontStack};
      font-size: var(--body-font-size);
      font-weight: 600;
      flex: 1;
      margin-right: 0.5rem;
    }
    
    .item-price {
      font-family: ${priceFontStack};
      font-size: var(--price-font-size);
      font-weight: ${template.fonts.price.weight || 700};
      ${template.fonts.price.tabular ? 'font-variant-numeric: tabular-nums;' : ''}
      white-space: nowrap;
      text-align: ${template.price.align};
    }
    
    .item-description {
      font-family: ${bodyFontStack};
      font-size: calc(var(--body-font-size) * 0.9);
      color: #4a4a4a;
      line-height: var(--line-height);
    }
    
    /* Camera Icon Styles (for imageDisplay: 'icon') */
    .camera-icon {
      display: inline-block;
      margin-left: 0.25rem;
      font-size: 0.9em;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .camera-icon:hover {
      opacity: 1;
    }
    
    /* Bleed Markers (dev mode only) */
    .bleed-markers {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9999;
    }
    
    .bleed-line {
      position: absolute;
      background-color: rgba(255, 0, 0, 0.3);
    }
    
    .bleed-line.top,
    .bleed-line.bottom {
      left: 0;
      right: 0;
      height: 1px;
    }
    
    .bleed-line.left,
    .bleed-line.right {
      top: 0;
      bottom: 0;
      width: 1px;
    }
    
    .bleed-line.top { top: ${template.canvas.bleed || 0}px; }
    .bleed-line.bottom { bottom: ${template.canvas.bleed || 0}px; }
    .bleed-line.left { left: ${template.canvas.bleed || 0}px; }
    .bleed-line.right { right: ${template.canvas.bleed || 0}px; }
    
    .safe-area-line {
      position: absolute;
      background-color: rgba(0, 0, 255, 0.3);
    }
    
    .safe-area-line.top,
    .safe-area-line.bottom {
      left: 0;
      right: 0;
      height: 1px;
    }
    
    .safe-area-line.left,
    .safe-area-line.right {
      top: 0;
      bottom: 0;
      width: 1px;
    }
    
    .safe-area-line.top { top: ${template.canvas.margins.top}px; }
    .safe-area-line.bottom { bottom: ${template.canvas.margins.bottom}px; }
    .safe-area-line.left { left: ${template.canvas.margins.left}px; }
    .safe-area-line.right { right: ${template.canvas.margins.right}px; }
    
    /* Applied Fit Policies */
    ${policyCSS}
  </style>`;
  }

  /**
   * Render menu header with title and branding
   * 
   * Requirements: 5.1, 10.2
   */
  private renderHeader(): string {
    const { menu } = this.options;
    
    return `<header class="menu-header">
    <h1 class="menu-title">${this.escapeHtml(menu.name)}</h1>
  </header>`;
  }

  /**
   * Render a menu section (category grouping)
   * 
   * Requirements: 5.2, 10.2
   */
  private renderSection(category: string, items: MenuItem[]): string {
    const itemsHtml = items
      .map(item => this.renderItem(item))
      .join('\n');
    
    return `<section class="menu-section">
    <h2 class="section-title">${this.escapeHtml(category)}</h2>
    <div class="section-items">
      ${itemsHtml}
    </div>
  </section>`;
  }

  /**
   * Render a single menu item
   * 
   * Requirements: 5.3, 10.2, 10.5
   */
  private renderItem(item: MenuItem): string {
    const { template, locale } = this.options;
    
    // Format price using Intl.NumberFormat for locale-aware formatting
    const formattedPrice = this.formatPrice(item.price, locale);
    
    // Render camera icon if item has image and template uses icon display
    const cameraIcon = this.renderCameraIcon(item);
    
    // Apply availability class
    const availabilityClass = item.available ? '' : ' unavailable';
    
    return `<article class="menu-item${availabilityClass}" data-item-id="${item.id}">
    <div class="item-header">
      <h3 class="item-name">
        ${this.escapeHtml(item.name)}${cameraIcon}
      </h3>
      <span class="item-price">${formattedPrice}</span>
    </div>
    ${item.description ? `<p class="item-description">${this.escapeHtml(item.description)}</p>` : ''}
  </article>`;
  }

  /**
   * Render camera icon for items with images
   * 
   * Only renders when template imageDisplay is 'icon' and item has an image.
   * 
   * Requirements: 7.1, 7.6, 7.7
   */
  private renderCameraIcon(item: MenuItem): string {
    const { template } = this.options;
    
    // Only render if template uses icon display mode
    if (template.imageDisplay !== 'icon') {
      return '';
    }
    
    // Only render if item has an image
    const hasImage = item.customImageUrl || item.aiImageId;
    if (!hasImage) {
      return '';
    }
    
    // Get image URL (prefer custom, fall back to AI)
    const imageUrl = item.customImageUrl || (item.aiImageId ? `/api/images/${item.aiImageId}` : '');
    
    return `<span class="camera-icon" 
      data-image-url="${this.escapeHtml(imageUrl)}" 
      data-item-name="${this.escapeHtml(item.name)}"
      role="button"
      aria-label="View image of ${this.escapeHtml(item.name)}"
      tabindex="0">📷</span>`;
  }

  /**
   * Format price with locale-aware currency formatting
   * 
   * Uses Intl.NumberFormat for proper currency display based on locale.
   * Respects template's decimal places configuration.
   * 
   * Requirements: 5.3, 10.5
   */
  private formatPrice(price: number, locale: string): string {
    const { template } = this.options;
    
    // Determine currency from template or auto-detect from locale
    let currency = template.price.currency;
    if (currency === 'auto') {
      // Auto-detect currency from locale
      const currencyMap: Record<string, string> = {
        'en-GB': 'GBP',
        'en-US': 'USD',
        'en-EU': 'EUR',
        'de-DE': 'EUR',
        'fr-FR': 'EUR',
        'es-ES': 'EUR',
        'it-IT': 'EUR',
      };
      currency = currencyMap[locale] || 'GBP';
    }
    
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: template.price.decimals,
        maximumFractionDigits: template.price.decimals,
      });
      
      return formatter.format(price);
    } catch (error) {
      // Fallback to simple formatting if Intl fails
      return `${currency} ${price.toFixed(template.price.decimals)}`;
    }
  }

  /**
   * Render bleed and safe area markers for print preview
   * 
   * Only shown in dev mode to help designers verify print margins.
   */
  private renderBleedMarkers(): string {
    return `<div class="bleed-markers">
    <div class="bleed-line top"></div>
    <div class="bleed-line bottom"></div>
    <div class="bleed-line left"></div>
    <div class="bleed-line right"></div>
    <div class="safe-area-line top"></div>
    <div class="safe-area-line bottom"></div>
    <div class="safe-area-line left"></div>
    <div class="safe-area-line right"></div>
  </div>`;
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
