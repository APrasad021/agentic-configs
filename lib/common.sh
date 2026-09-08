# Shared helpers for the agentic CLI. Sourced, never executed.

die() { printf 'agentic: %s\n' "$*" >&2; exit 1; }
warn() { printf 'agentic: %s\n' "$*" >&2; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"; }

# jq does all manifest parsing so manifests stay machine-readable for agents too.
need jq

PATTERNS_DIR="$AGENTIC_ROOT/patterns"

# pattern_dir <id> -> absolute path, or fail
pattern_dir() {
  local id="$1" dir="$PATTERNS_DIR/$1"
  [ -f "$dir/pattern.json" ] || die "no such pattern: $id (try 'agentic list')"
  printf '%s\n' "$dir"
}

# all_pattern_ids -> one id per line, sorted
all_pattern_ids() {
  find "$PATTERNS_DIR" -mindepth 3 -maxdepth 3 -name pattern.json -print \
    | sed "s|^$PATTERNS_DIR/||; s|/pattern.json$||" \
    | sort
}

# manifest <id> -> the pattern.json contents
manifest() { cat "$(pattern_dir "$1")/pattern.json"; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

is_text() { grep -Iq . "$1" 2>/dev/null; }

# detect_stacks <target-dir> -> stack ids present in that project, one per line.
# sh is always in play: every project can use shell scripts and dotfiles.
detect_stacks() {
  local t="$1"
  if [ -f "$t/package.json" ] || [ -f "$t/tsconfig.json" ]; then echo ts; fi
  if [ -f "$t/pyproject.toml" ] || [ -f "$t/requirements.txt" ] || [ -f "$t/setup.py" ]; then echo py; fi
  echo sh
}

# Colors, but only for a terminal.
if [ -t 1 ]; then
  C_DIM=$'\033[2m'; C_B=$'\033[1m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_0=$'\033[0m'
else
  C_DIM=; C_B=; C_OK=; C_WARN=; C_ERR=; C_0=
fi
