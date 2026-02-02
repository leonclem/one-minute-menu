/**
 * Output Validation
 * 
 * Validates rendered PDF and image outputs to ensure they meet format requirements.
 * Implements Requirements 2.5, 2.6
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  file_size: number;
  format_verified: boolean;
}

// Minimum file size threshold (warning, not hard failure)
const MIN_FILE_SIZE_BYTES = 256;

// File format signatures
const PDF_SIGNATURE = '%PDF-';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_SOI_MARKER = Buffer.from([0xFF, 0xD8]);
const JPEG_EOI_MARKER = Buffer.from([0xFF, 0xD9]);

/**
 * Validates PDF output format
 * 
 * Checks for:
 * - Valid PDF signature (%PDF- at start)
 * - Minimum file size
 * 
 * @param buffer - The PDF file buffer to validate
 * @returns ValidationResult with validation status and details
 * 
 * Requirements: 2.5, 2.6
 */
export function validatePDF(buffer: Buffer): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let format_verified = false;

  // Check if buffer is null/undefined or empty
  if (!buffer || buffer.length === 0) {
    const file_size = buffer?.length || 0;
    errors.push('PDF buffer is empty');
    return {
      valid: false,
      errors,
      warnings,
      file_size,
      format_verified: false,
    };
  }

  const file_size = buffer.length;

  // Check PDF signature
  const signature = buffer.toString('utf8', 0, PDF_SIGNATURE.length);
  if (signature === PDF_SIGNATURE) {
    format_verified = true;
  } else {
    errors.push(
      `Invalid PDF signature. Expected "${PDF_SIGNATURE}" but got "${signature}". ` +
      'The file may be corrupted or not a valid PDF.'
    );
  }

  // Check minimum file size (warning only)
  if (file_size < MIN_FILE_SIZE_BYTES) {
    warnings.push(
      `PDF file size (${file_size} bytes) is below recommended minimum (${MIN_FILE_SIZE_BYTES} bytes). ` +
      'The file may be incomplete or contain minimal content.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file_size,
    format_verified,
  };
}

/**
 * Validates PNG output format
 * 
 * Checks for:
 * - Valid PNG signature (8-byte header)
 * - Minimum file size
 * 
 * @param buffer - The PNG file buffer to validate
 * @returns ValidationResult with validation status and details
 * 
 * Requirements: 2.5, 2.6
 */
export function validatePNG(buffer: Buffer): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let format_verified = false;

  // Check if buffer is null/undefined or empty
  if (!buffer || buffer.length === 0) {
    const file_size = buffer?.length || 0;
    errors.push('PNG buffer is empty');
    return {
      valid: false,
      errors,
      warnings,
      file_size,
      format_verified: false,
    };
  }

  const file_size = buffer.length;

  // Check PNG signature (first 8 bytes)
  if (buffer.length >= PNG_SIGNATURE.length) {
    const signature = buffer.subarray(0, PNG_SIGNATURE.length);
    if (signature.equals(PNG_SIGNATURE)) {
      format_verified = true;
    } else {
      errors.push(
        'Invalid PNG signature. Expected PNG header bytes but got different values. ' +
        'The file may be corrupted or not a valid PNG.'
      );
    }
  } else {
    errors.push(
      `PNG buffer too small (${buffer.length} bytes). ` +
      `Expected at least ${PNG_SIGNATURE.length} bytes for PNG signature.`
    );
  }

  // Check minimum file size (warning only)
  if (file_size < MIN_FILE_SIZE_BYTES) {
    warnings.push(
      `PNG file size (${file_size} bytes) is below recommended minimum (${MIN_FILE_SIZE_BYTES} bytes). ` +
      'The file may be incomplete or contain minimal content.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file_size,
    format_verified,
  };
}

/**
 * Validates JPEG output format
 * 
 * Checks for:
 * - Valid JPEG SOI (Start of Image) marker (0xFF 0xD8)
 * - Valid JPEG EOI (End of Image) marker (0xFF 0xD9) at end
 * - Minimum file size
 * 
 * @param buffer - The JPEG file buffer to validate
 * @returns ValidationResult with validation status and details
 * 
 * Requirements: 2.5, 2.6
 */
export function validateJPEG(buffer: Buffer): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let format_verified = false;

  // Check if buffer is null/undefined or empty
  if (!buffer || buffer.length === 0) {
    const file_size = buffer?.length || 0;
    errors.push('JPEG buffer is empty');
    return {
      valid: false,
      errors,
      warnings,
      file_size,
      format_verified: false,
    };
  }

  const file_size = buffer.length;

  // Check JPEG SOI marker (first 2 bytes)
  if (buffer.length >= JPEG_SOI_MARKER.length) {
    const soiMarker = buffer.subarray(0, JPEG_SOI_MARKER.length);
    if (!soiMarker.equals(JPEG_SOI_MARKER)) {
      errors.push(
        'Invalid JPEG SOI marker. Expected 0xFF 0xD8 at start but got different values. ' +
        'The file may be corrupted or not a valid JPEG.'
      );
    }
  } else {
    errors.push(
      `JPEG buffer too small (${buffer.length} bytes). ` +
      `Expected at least ${JPEG_SOI_MARKER.length} bytes for JPEG SOI marker.`
    );
  }

  // Check JPEG EOI marker (last 2 bytes)
  if (buffer.length >= JPEG_EOI_MARKER.length) {
    const eoiMarker = buffer.subarray(buffer.length - JPEG_EOI_MARKER.length);
    if (eoiMarker.equals(JPEG_EOI_MARKER)) {
      // Both SOI and EOI markers are valid
      if (errors.length === 0) {
        format_verified = true;
      }
    } else {
      warnings.push(
        'JPEG EOI marker not found at end of file. ' +
        'The file may be incomplete or truncated.'
      );
    }
  }

  // Check minimum file size (warning only)
  if (file_size < MIN_FILE_SIZE_BYTES) {
    warnings.push(
      `JPEG file size (${file_size} bytes) is below recommended minimum (${MIN_FILE_SIZE_BYTES} bytes). ` +
      'The file may be incomplete or contain minimal content.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file_size,
    format_verified,
  };
}

/**
 * Validates file size
 * 
 * Checks if file size meets minimum threshold (warning only, not hard failure)
 * 
 * @param buffer - The file buffer to validate
 * @returns ValidationResult with size validation status
 * 
 * Requirements: 2.5, 2.6
 */
export function validateSize(buffer: Buffer): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if buffer is null/undefined or empty
  if (!buffer || buffer.length === 0) {
    const file_size = buffer?.length || 0;
    errors.push('File buffer is empty');
    return {
      valid: false,
      errors,
      warnings,
      file_size,
      format_verified: false,
    };
  }

  const file_size = buffer.length;

  if (file_size < MIN_FILE_SIZE_BYTES) {
    warnings.push(
      `File size (${file_size} bytes) is below recommended minimum (${MIN_FILE_SIZE_BYTES} bytes). ` +
      'The file may be incomplete or contain minimal content.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file_size,
    format_verified: false, // Size check doesn't verify format
  };
}

/**
 * Validates rendered output based on export type
 * 
 * Routes to appropriate format validator based on export type
 * 
 * @param buffer - The rendered output buffer
 * @param exportType - The export type ('pdf' or 'image')
 * @param imageFormat - The image format ('png' or 'jpeg'), required if exportType is 'image'
 * @returns ValidationResult with validation status and details
 * 
 * Requirements: 2.5, 2.6
 */
export function validateOutput(
  buffer: Buffer,
  exportType: 'pdf' | 'image',
  imageFormat?: 'png' | 'jpeg'
): ValidationResult {
  if (exportType === 'pdf') {
    return validatePDF(buffer);
  }

  if (exportType === 'image') {
    if (!imageFormat) {
      return {
        valid: false,
        errors: ['Image format must be specified for image exports'],
        warnings: [],
        file_size: buffer.length,
        format_verified: false,
      };
    }

    if (imageFormat === 'png') {
      return validatePNG(buffer);
    }

    if (imageFormat === 'jpeg') {
      return validateJPEG(buffer);
    }

    return {
      valid: false,
      errors: [`Unsupported image format: ${imageFormat}`],
      warnings: [],
      file_size: buffer.length,
      format_verified: false,
    };
  }

  return {
    valid: false,
    errors: [`Unsupported export type: ${exportType}`],
    warnings: [],
    file_size: buffer.length,
    format_verified: false,
  };
}
