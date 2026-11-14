const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function readFrontendIndex() {
  return fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
}

function listFrontendScriptPaths() {
  const html = readFrontendIndex();
  const paths = [];
  for (const m of html.matchAll(/<script\s+src="([^"]+)"[^>]*>\s*<\/script>/g)) {
    const rel = m[1].replace(/^\/+/, '');
    paths.push(path.join(PUBLIC_DIR, rel));
  }
  return paths;
}

function readFrontendScripts() {
  return listFrontendScriptPaths().map(p => fs.readFileSync(p, 'utf8'));
}

function readFrontendBundle() {
  const html = readFrontendIndex();
  const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');
  const scripts = readFrontendScripts().join('\n');
  return [html, css, scripts].join('\n');
}

module.exports = {
  PUBLIC_DIR,
  readFrontendIndex,
  listFrontendScriptPaths,
  readFrontendScripts,
  readFrontendBundle
};
