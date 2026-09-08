#!/usr/bin/env bash
# Refuse to commit a binary large enough to be a permanent regret.
#
#   scripts/check-media.sh            # check staged files
#   MAX_KB=2048 scripts/check-media.sh
#
# Hook it up:  git config core.hooksPath scripts/hooks  (see repo/git-conventions)

set -euo pipefail

MAX_KB="${MAX_KB:-1024}"
fail=0

while IFS= read -r file; do
  [ -f "$file" ] || continue
  # Text files are fine at any size; it is binaries that never delta.
  if grep -Iq . "$file" 2>/dev/null; then continue; fi

  kb=$(( $(wc -c < "$file") / 1024 ))
  if [ "$kb" -gt "$MAX_KB" ]; then
    echo "check-media: $file is ${kb}KB (limit ${MAX_KB}KB)" >&2
    fail=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACM)

if [ "$fail" -eq 1 ]; then
  cat >&2 <<'MSG'

Git keeps every version of a binary forever, in every clone, including CI.
Options:
  - compress it (oxipng / pngquant / WebP)
  - put it in object storage and commit the URL
  - adopt Git LFS deliberately (see docs/media-assets.md)
  - override for this commit: MAX_KB=99999 git commit
MSG
  exit 1
fi
