// Builds the web version of the app into dist-web/ and adds what phones need
// to install it from the browser ("Add to Home Screen").
// Usage: node scripts/build-web.mjs   then   npx wrangler deploy
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx expo export --platform web --output-dir dist-web --clear', { stdio: 'inherit', env: { ...process.env, CI: '1' } });

// Cloudflare's static hosting redirects in a loop on paths containing "@", which
// breaks every asset under a scoped package (node_modules/@expo/..., the fonts).
// Rename those folders and point the bundles at the new paths.
const renameScoped = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    let target = full;
    if (name.startsWith('@')) {
      target = join(dir, '_at_' + name.slice(1));
      renameSync(full, target);
    }
    renameScoped(target);
  }
};
renameScoped('dist-web/assets');
const rewrite = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) rewrite(full);
    else if (/\.(js|html|json|css|map)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      if (text.includes('node_modules/@')) writeFileSync(full, text.replaceAll('node_modules/@', 'node_modules/_at_'));
    }
  }
};
rewrite('dist-web');

const file = 'dist-web/index.html';
const head = [
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<meta name="theme-color" content="#1C2B4F" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Saathi" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join('\n    ');
let html = readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${head}\n  </head>`);
writeFileSync(file, html);
console.log('Web app ready in dist-web/');
