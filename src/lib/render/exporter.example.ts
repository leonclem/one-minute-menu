/**
 * Example usage of MenuExporter
 * 
 * This file demonstrates how to use the MenuExporter class to export
 * rendered menu HTML to PDF and PNG formats.
 */

import { MenuExporter, exportMenu } from './exporter';
import type { ExportOptions } from './exporter';

// Example 1: Export to PDF using the class
async function exportToPDF(html: string): Promise<Buffer> {
  const exporter = new MenuExporter();
  
  const options: ExportOptions = {
    format: 'pdf',
    dpi: 300,
    size: 'A4',
  };
  
  return await exporter.export(html, options);
}

// Example 2: Export to PNG using the convenience function
async function exportToPNG(html: string): Promise<Buffer> {
  const options: ExportOptions = {
    format: 'png',
    dpi: 300,
    size: 'A4',
  };
  
  return await exportMenu(html, options);
}

// Example 3: Export with glyph validation
async function exportWithValidation(html: string): Promise<Buffer> {
  const options: ExportOptions = {
    format: 'pdf',
    dpi: 300,
    size: 'A4',
    validateGlyphs: true, // Validate special characters
  };
  
  return await exportMenu(html, options);
}

// Example 4: Export to A3 at high DPI
async function exportHighQuality(html: string): Promise<Buffer> {
  const options: ExportOptions = {
    format: 'pdf',
    dpi: 300, // Note: 600 DPI may cause issues with large pages
    size: 'A3',
  };
  
  return await exportMenu(html, options);
}

// Example 5: Error handling
async function exportWithErrorHandling(html: string): Promise<Buffer | null> {
  try {
    const options: ExportOptions = {
      format: 'pdf',
      dpi: 300,
      size: 'A4',
    };
    
    return await exportMenu(html, options);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Export failed:', error.message);
      
      // Check if it's an ExportError with specific code
      if ('code' in error) {
        const exportError = error as any;
        console.error('Error code:', exportError.code);
        console.error('Error stage:', exportError.stage);
      }
    }
    
    return null;
  }
}

// Example 6: Complete workflow with MenuRenderer
async function completeExportWorkflow() {
  // This would typically come from MenuRenderer
  const html = `
    <!DOCTYPE html>
    <html lang="en-GB">
    <head>
      <meta charset="UTF-8">
      <title>My Restaurant Menu</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { text-align: center; }
      </style>
    </head>
    <body>
      <h1>My Restaurant</h1>
      <p>Delicious food served daily</p>
    </body>
    </html>
  `;
  
  // Export to PDF
  const pdfBuffer = await exportToPDF(html);
  console.log('PDF size:', pdfBuffer.length, 'bytes');
  
  // Export to PNG
  const pngBuffer = await exportToPNG(html);
  console.log('PNG size:', pngBuffer.length, 'bytes');
  
  // In a real application, you would save these buffers to files or send them to the client
  // For example:
  // await fs.writeFile('menu.pdf', pdfBuffer);
  // await fs.writeFile('menu.png', pngBuffer);
}

// Export examples for use in other modules
export {
  exportToPDF,
  exportToPNG,
  exportWithValidation,
  exportHighQuality,
  exportWithErrorHandling,
  completeExportWorkflow,
};
