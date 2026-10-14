#!/usr/bin/env bash
# Gera o site estático em docs/ (GitHub Pages: branch main, pasta /docs).
set -euo pipefail
bun run build
OUT=""
for d in dist/client .output/public dist; do [ -f "$d/index.html" ] && OUT="$d" && break; done
[ -n "$OUT" ] || { echo "index.html não encontrado"; exit 1; }
rm -rf docs && cp -r "$OUT" docs
sed -i 's|"/\./|"./|g; s|"/assets/|"./assets/|g; s|"/favicon.ico|"./favicon.ico|g' docs/index.html
cp docs/index.html docs/404.html
touch docs/.nojekyll
echo "OK: docs/"
