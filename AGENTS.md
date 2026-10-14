<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- GitHub Pages deploy: run `bash scripts/build-pages.sh`, which writes the static site to committed `docs/` (Pages source: main /docs); router uses hash history so subpath hosting never 404s.
- Offline PWA: public/sw.js is cache-first; scripts/build-pages.sh injects the full asset list and a version hash into docs/sw.js, so always deploy via that script.
