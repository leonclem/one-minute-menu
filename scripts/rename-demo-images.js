
const fs = require('fs');
const path = require('path');

const dirs = [
  'public/ux/sample-menus/generated/breakfast',
  'public/ux/sample-menus/generated/fine-dining'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.webp')) {
      const oldPath = path.join(dir, file);
      // Convert to kebab-case: lowercase, replace spaces/special chars with dashes
      const newName = file.toLowerCase()
        .replace(/['!&]/g, '') // Remove special chars first
        .replace(/\s+/g, '-')  // Replace spaces with dashes
        .replace(/-+/g, '-')   // Collapse multiple dashes
        .replace(/\.webp$/, '.webp'); // Ensure extension is clean

      const newPath = path.join(dir, newName);
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed: ${file} -> ${newName}`);
      }
    }
  });
});

