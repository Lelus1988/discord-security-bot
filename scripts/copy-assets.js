// Copies webpanel/public (static HTML/CSS/JS, not compiled by tsc) into dist/webpanel/public.
// Runs automatically after `npm run build` (see package.json).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'webpanel', 'public');
const dest = path.join(__dirname, '..', 'dist', 'webpanel', 'public');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`✅ Copied webpanel static assets → ${path.relative(process.cwd(), dest)}`);
