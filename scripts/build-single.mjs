// Builds the whole app as ONE self-contained HTML file (works offline, data saved in that browser).
// Usage: node scripts/build-demo.mjs [outfile]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nodePaths = [path.join(root, 'node_modules'), '/opt/npm-tools/node_modules'];
const stub = (f) => path.join(root, 'web-stubs', f);
const alias = {
  '@capacitor/core': stub('capacitor.js'), '@capacitor/local-notifications': stub('capacitor.js'), '@capacitor/clipboard': stub('capacitor.js'), '@capacitor/filesystem': stub('capacitor.js'), '@capacitor/share': stub('capacitor.js'),
};
const r = await build({
  entryPoints: [path.join(root, 'src/main.jsx')], bundle: true, minify: true, write: false, format: 'iife',
  jsx: 'automatic', loader: { '.js': 'jsx' }, nodePaths, alias, outdir: 'out',
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
});
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = r.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
const icon = fs.existsSync(path.join(root, 'public/icons/icon-192.png')) ? 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public/icons/icon-192.png')).toString('base64') : '';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f766e"><title>Kharcha</title>${icon ? `<link rel="icon" href="${icon}">` : ''}<style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`;
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist-single/kharcha.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
