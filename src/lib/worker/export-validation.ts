/**
 * Export Request Validation
 * 
 * Validates export requests for PDF and image generation.
 * Implements Requirements 11.1, 13.5, 13.6, 14.7
 */

export type ExportType = 'pdf' | 'image';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Configuration constants (can be overridden via environment variables)
const MAX_HTML_SIZE_BYTES = parseInt(process.env.MAX_EXPORT_HTML_SIZE || '5242880', 10); // 5MB default
const MAX_IMAGE_COUNT = parseInt(process.env.MAX_EXPORT_IMAGE_COUNT || '100', 10); // 100 images default
const TRUSTED_STORAGE_DOMAINS = [
  'supabase.co',
  'supabase.in',
  // Add your specific Supabase project domain
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').split('/')[0],
].filter(Boolean) as string[];

/**
 * Validates export type
 * 
 * @param exportType - The export type to validate
 * @returns ValidationResult indicating if the export type is valid
 * 
 * Requirements: 11.1, 11.5
 */
export function validateExportType(exportType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!exportType) {
    errors.push('Export type is required');
  } else if (exportType !== 'pdf' && exportType !== 'image') {
    errors.push(`Invalid export type: ${exportType}. Must be 'pdf' or 'image'`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates menu HTML size
 * 
 * @param html - The HTML content to validate
 * @returns ValidationResult indicating if the HTML size is within limits
 * 
 * Requirements: 13.5, 13.7
 */
export function validateMenuHTML(html: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!html) {
    errors.push('Menu HTML is required');
    return { valid: false, errors, warnings };
  }

  const sizeBytes = Buffer.byteLength(html, 'utf8');
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

  if (sizeBytes > MAX_HTML_SIZE_BYTES) {
    errors.push(
      `Menu HTML size (${sizeMB}MB) exceeds maximum allowed size (${(MAX_HTML_SIZE_BYTES / (1024 * 1024)).toFixed(2)}MB). ` +
      'Please reduce content or remove large embedded assets.'
    );
  }

  // Warning for large but acceptable HTML
  if (sizeBytes > MAX_HTML_SIZE_BYTES * 0.8 && sizeBytes <= MAX_HTML_SIZE_BYTES) {
    warnings.push(
      `Menu HTML size (${sizeMB}MB) is approaching the maximum limit. ` +
      'Consider optimizing content for better performance.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates image count in menu HTML
 * 
 * @param html - The HTML content to validate
 * @returns ValidationResult indicating if the image count is within limits
 * 
 * Requirements: 13.6, 13.7
 */
export function validateImageCount(html: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!html) {
    errors.push('Menu HTML is required');
    return { valid: false, errors, warnings };
  }

  // Count <img> tags in HTML
  const imgTagRegex = /<img[^>]*>/gi;
  const imgTags = html.match(imgTagRegex) || [];
  const imageCount = imgTags.length;

  if (imageCount > MAX_IMAGE_COUNT) {
    errors.push(
      `Menu contains ${imageCount} images, which exceeds the maximum allowed (${MAX_IMAGE_COUNT}). ` +
      'Please reduce the number of images.'
    );
  }

  // Warning for high but acceptable image count
  if (imageCount > MAX_IMAGE_COUNT * 0.8 && imageCount <= MAX_IMAGE_COUNT) {
    warnings.push(
      `Menu contains ${imageCount} images, which is approaching the maximum limit. ` +
      'Consider reducing images for better performance.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that all image URLs point to trusted Supabase Storage domains
 * 
 * @param html - The HTML content to validate
 * @returns ValidationResult indicating if all image URLs are from trusted domains
 * 
 * Requirements: 14.7
 */
export function validateImageURLs(html: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!html) {
    errors.push('Menu HTML is required');
    return { valid: false, errors, warnings };
  }

  // Extract all src attributes from <img> tags
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const untrustedUrls: string[] = [];
  let match;

  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = match[1];
    
    // Skip data URLs (base64 encoded images)
    if (url.startsWith('data:')) {
      continue;
    }

    // Skip relative URLs (assumed to be from the same domain)
    if (url.startsWith('/') || !url.includes('://')) {
      continue;
    }

    // Check if URL is from a trusted domain
    const isTrusted = TRUSTED_STORAGE_DOMAINS.some(domain => 
      url.includes(domain)
    );

    if (!isTrusted) {
      untrustedUrls.push(url);
    }
  }

  if (untrustedUrls.length > 0) {
    errors.push(
      `Menu contains ${untrustedUrls.length} image(s) from untrusted domains. ` +
      'All images must be hosted on Supabase Storage. ' +
      `Untrusted URLs: ${untrustedUrls.slice(0, 3).join(', ')}${untrustedUrls.length > 3 ? '...' : ''}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates all export request parameters
 * 
 * @param exportType - The export type (pdf or image)
 * @param html - The menu HTML content
 * @returns Combined ValidationResult from all validation checks
 */
export function validateExportRequest(
  exportType: string,
  html: string
): ValidationResult {
  const results = [
    validateExportType(exportType),
    validateMenuHTML(html),
    validateImageCount(html),
    validateImageURLs(html),
  ];

  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
