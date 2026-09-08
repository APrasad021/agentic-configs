#!/usr/bin/env bash
# Load .env into the current shell, and fail loudly if a key .env.example
# declares as required is missing.
#
#   . scripts/load-env.sh          # source it — exports into your shell
#   scripts/load-env.sh --check    # just validate, for CI or a pre-push hook
#
# Deliberately does NOT print values. If you need to confirm a key is loaded,
# check its length, not its content.

set -euo pipefail

_env_file="${ENV_FILE:-.env}"
_example_file="${ENV_EXAMPLE:-.env.example}"

if [ ! -f "$_env_file" ]; then
  echo "load-env: $_env_file not found — copy $_example_file and fill it in" >&2
  return 1 2>/dev/null || exit 1
fi

# Export every KEY=VALUE line, ignoring comments and blanks.
set -a
# shellcheck disable=SC1090
. "$_env_file"
set +a

# Any key present in .env.example with a non-empty default is treated as
# required; keys shipped empty are optional by convention.
_missing=()
while IFS='=' read -r key default; do
  case "$key" in ''|'#'*) continue ;; esac
  [ -n "$default" ] || continue
  if [ -z "${!key:-}" ]; then _missing+=("$key"); fi
done < <(grep -v '^\s*#' "$_example_file" | grep '=' || true)

if [ ${#_missing[@]} -gt 0 ]; then
  echo "load-env: missing required keys: ${_missing[*]}" >&2
  return 1 2>/dev/null || exit 1
fi

if [ "${1:-}" = "--check" ]; then
  echo "load-env: $_env_file satisfies $_example_file"
fi
