/**
 * Template Descriptor Validation Script
 * 
 * Validates all template descriptor JSON files to ensure they conform to the schema.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { validateDescriptorSafe } from '../src/lib/templates/validation';

const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates');

const templateFiles = [
  'kraft-sports.json',
  'minimal-bistro.json'
];

console.log('🔍 Validating template descriptors...\n');

let hasErrors = false;

for (const filename of templateFiles) {
  const filepath = join(TEMPLATES_DIR, filename);
  
  try {
    const content = readFileSync(filepath, 'utf-8');
    const descriptor = JSON.parse(content);
    
    const result = validateDescriptorSafe(descriptor);
    
    if (result.success) {
      console.log(`✅ ${filename}: Valid`);
      console.log(`   ID: ${result.data!.id}`);
      console.log(`   Name: ${result.data!.name}`);
      console.log(`   Version: ${result.data!.version}`);
      console.log(`   Canvas: ${result.data!.canvas.size} @ ${result.data!.canvas.dpi} DPI`);
      console.log(`   Columns: ${result.data!.canvas.cols}`);
      console.log(`   Image Display: ${result.data!.imageDisplay}`);
      console.log('');
    } else {
      console.error(`❌ ${filename}: Invalid`);
      console.error('   Errors:');
      result.errors!.forEach(err => {
        console.error(`     - ${err.field}: ${err.message}`);
      });
      console.error('');
      hasErrors = true;
    }
  } catch (error) {
    console.error(`❌ ${filename}: Failed to load`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('❌ Validation failed with errors');
  process.exit(1);
} else {
  console.log('✅ All templates validated successfully');
  process.exit(0);
}
