# catalog — regenerate catalog.json from every pattern.json.
#
# The catalog is derived, never hand-edited: adding a pattern means adding one
# directory, not editing a central registry. Agents read catalog.json to see
# everything available in one request.

cmd_catalog() {
  local out="$AGENTIC_ROOT/catalog.json"
  local tmp; tmp=$(mktemp)
  local id

  {
    printf '{\n  "schema": 1,\n'
    printf '  "generated": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "patterns": [\n'
    local first=1
    while read -r id; do
      [ $first -eq 1 ] || printf ',\n'
      first=0
      jq -c --arg id "$id" '{id:$id} + {summary,status,version,stacks,requires,tools,tags}' \
        "$PATTERNS_DIR/$id/pattern.json" | sed 's/^/    /'
    done < <(all_pattern_ids)
    printf '\n  ]\n}\n'
  } > "$tmp"

  jq . "$tmp" > "$out" && rm -f "$tmp"
  printf 'wrote %s (%d patterns)\n' "$out" "$(jq '.patterns | length' "$out")"

  # Integrity pass. Cheap checks that catch the mistakes actually made when
  # authoring a pattern.
  local rc=0 stack dup
  while read -r id; do
    local pdir="$PATTERNS_DIR/$id"

    # A manifest that names a stack it does not ship.
    while read -r stack; do
      if [ ! -d "$pdir/files/$stack" ]; then
        warn "$id declares stack '$stack' but has no files/$stack/ directory"; rc=1
      fi
    done < <(jq -r '.stacks[]' "$pdir/pattern.json")

    # A files/ subdirectory the manifest does not declare — it would never be
    # copied, which is a silently broken pattern.
    while read -r stack; do
      case "$stack" in _common) continue ;; esac
      if ! jq -e --arg s "$stack" '.stacks | index($s)' >/dev/null <<<"$(cat "$pdir/pattern.json")"; then
        warn "$id ships files/$stack/ but does not declare stack '$stack' — those files will never be copied"; rc=1
      fi
    done < <(if [ -d "$pdir/files" ]; then ls -1 "$pdir/files"; fi)

    # Two stacks writing the same destination path. apply copies _common first
    # and reports the rest as "exists, skipped" — visible, but confusing. See
    # decisions/0003.
    dup=$(cd "$pdir/files" 2>/dev/null && find . -mindepth 2 -type f \
            | sed 's|^\./[^/]*/||' | sort | uniq -d || true)
    if [ -n "$dup" ]; then
      warn "$id has the same destination path in more than one stack: $(tr '\n' ' ' <<<"$dup")"; rc=1
    fi

    # Required dependencies must resolve.
    while read -r dep; do
      [ -n "$dep" ] || continue
      if [ ! -f "$PATTERNS_DIR/$dep/pattern.json" ]; then
        warn "$id requires '$dep', which does not exist"; rc=1
      fi
    done < <(jq -r '.requires[]?' "$pdir/pattern.json")

    if [ ! -f "$pdir/README.md" ]; then
      warn "$id has no README.md"; rc=1
    fi
  done < <(all_pattern_ids)

  if [ "$rc" -eq 0 ]; then printf 'integrity: ok\n'; fi
  return $rc
}
