#!/usr/bin/env bash
# Rebuild FilmCraft for the web from a local checkout and publish it here (GitHub Pages).
#
#   ./deploy.sh [path/to/filmcraft]      default: ../storytold/filmcraft
#
# Needs what `cargo xtask web` needs (FilmCraft's docs/web.md): the wasm32-unknown-unknown target
# and the wasm-bindgen CLI at the version the crate pins. Each deploy replaces the site with a
# single fresh commit (force-pushed), so the repository doesn't grow by ~35 MB every time.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC="$(cd "${1:-$HERE/../storytold/filmcraft}" && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"

(cd "$FC" && cargo xtask web && packaging/web/package.sh --skip-build)
SITE="$(ls -d "${CARGO_TARGET_DIR:-$FC/target}"/web-package/filmcraft-web-*/ | head -n 1)"
VERSION="$(basename "$SITE")"
VERSION="${VERSION#filmcraft-web-}"
SHA="$(git -C "$FC" rev-parse --short HEAD)"
LOCAL=""
if [ -n "$(git -C "$FC" status --porcelain)" ]; then LOCAL=" + local changes"; fi

cd "$HERE"
# Replace the published files; keep this repository's own.
{ git ls-files | grep -v -x -e README.md -e deploy.sh -e .nojekyll || true; } | xargs -r git rm -q --
for f in "$SITE"/*; do
  case "$(basename "$f")" in
    README.md | HOSTING.md | _headers) ;; # FilmCraft's own docs and other hosts' config
    *) cp "$f" . ;;
  esac
done
# Licence notices for the code and the fonts built into the wasm.
cp "$FC/NOTICE" "$FC"/assets/fonts/OFL-*.txt .
touch .nojekyll

git add -A
git checkout -q --orphan deploy-next
git commit -q -m "FilmCraft $VERSION web build from storytold/filmcraft@$SHA$LOCAL"
git branch -M main
git push -q -f -u origin main

REMOTE="$(git remote get-url origin)"
REPO="${REMOTE%.git}"
OWNER="$(basename "$(dirname "$REPO")")"
echo "published FilmCraft $VERSION ($SHA$LOCAL): https://$OWNER.github.io/$(basename "$REPO")/ (live in a minute or two)"
