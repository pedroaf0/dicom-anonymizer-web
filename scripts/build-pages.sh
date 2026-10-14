#!/usr/bin/env bash
# Gera o site estático em docs/ (GitHub Pages: branch main, pasta /docs).
set -euo pipefail
bun run build
OUT=""
for d in dist/client .output/public dist; do [ -f "$d/index.html" ] && OUT="$d" && break; done
[ -n "$OUT" ] || { echo "index.html não encontrado"; exit 1; }
rm -rf docs && cp -r "$OUT" docs
sed -i 's|"/\./|"./|g; s|"/assets/|"./assets/|g; s|"/favicon.ico|"./favicon.ico|g; s|"/manifest.webmanifest|"./manifest.webmanifest|g; s|"/icon-|"./icon-|g' docs/index.html
# Pré-cache de todos os arquivos para funcionar 100% offline desde a primeira visita.
LIST=$(cd docs && find . -type f ! -name sw.js ! -name 404.html ! -name .nojekyll ! -name robots.txt | sed 's|^\./||' | sort | sed 's/.*/"&"/' | paste -sd, -)
VER=$(cat docs/index.html | sha256sum | cut -c1-10)
sed -i "s|/\*PRECACHE\*/|$LIST|; s|/\*VERSION\*/|$VER|" docs/sw.js
cp docs/index.html docs/404.html
touch docs/.nojekyll
rm -rf dist .output
echo "OK: docs/"
