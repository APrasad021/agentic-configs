# new — scaffold a new pattern so adding one stays a 10-second operation.

cmd_new() {
  local id="${1:?usage: agentic new <domain/name>}"
  case "$id" in */*) ;; *) die "pattern id must be <domain>/<name>" ;; esac
  local dir="$PATTERNS_DIR/$id"
  if [ -e "$dir" ]; then die "already exists: $dir"; fi

  mkdir -p "$dir/files/_common"
  cat > "$dir/pattern.json" <<JSON
{
  "id": "$id",
  "summary": "One line: what this gives a project.",
  "status": "draft",
  "version": "0.1.0",
  "stacks": [],
  "requires": [],
  "tools": [],
  "tags": [],
  "vars": {},
  "next": []
}
JSON
  cat > "$dir/README.md" <<MD
# ${id#*/}

> Status: **draft**

## What this is

## When to use it

## What it ships

## How to adapt it

## Open questions
MD
  printf 'created %s\n' "$dir"
  printf 'now: add files under files/_common (or files/ts, files/py, files/sh), then run: agentic catalog\n'
}
