// Script to fix @/ path aliases in compiled JavaScript files
const fs = require('fs');
const path = require('path');

function fixPathsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Calculate relative path from this file to dist root
  const fileDir = path.dirname(filePath);
  const distRoot = path.join(__dirname, 'dist');
  const relativeToRoot = path.relative(fileDir, distRoot);
  
  // For files in dist/lib/worker, we need to go up to dist, then into lib
  // So @/lib/something becomes ../../lib/something
  const replacement = relativeToRoot ? relativeToRoot.replace(/\\/g, '/') + '/' : './';
  
  // Replace all variations of @/ imports
  const patterns = [
    { from: /require\("@\//g, to: `require("${replacement}` },
    { from: /require\('@\//g, to: `require('${replacement}` },
    { from: /from "@\//g, to: `from "${replacement}` },
    { from: /from '@\//g, to: `from '${replacement}` }
  ];
  
  for (const pattern of patterns) {
    if (pattern.from.test(content)) {
      content = content.replace(pattern.from, pattern.to);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath} (using prefix: ${replacement})`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js')) {
      fixPathsInFile(filePath);
    }
  }
}

console.log('Fixing path aliases in dist/...');
if (fs.existsSync('./dist')) {
  walkDir('./dist');
  console.log('Done!');
} else {
  console.error('dist/ directory not found!');
  process.exit(1);
}
