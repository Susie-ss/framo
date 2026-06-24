// zip_helper.js — use "tar -czf" to handle macOS symlinks (tar preserves them natively)
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const source = process.argv[2];
const dest = process.argv[3];

if (!source || !dest) {
    console.error('Usage: node zip_helper.js <source-dir> <dest-tar.gz>');
    process.exit(1);
}

if (!fs.existsSync(source)) {
    console.error('Source not found: ' + source);
    process.exit(1);
}

const sourceDir = path.dirname(source);
const sourceName = path.basename(source);

// tar -czf dest.tar.gz -C parentDir folderName
const cmd = `tar -czf "${dest}" -C "${sourceDir}" "${sourceName}"`;
console.log('  zipping via tar...');
execSync(cmd, { stdio: 'inherit' });

const stats = fs.statSync(dest);
const mb = (stats.size / 1024 / 1024).toFixed(1);
console.log('  ' + path.basename(dest) + ' (' + mb + ' MB)');
