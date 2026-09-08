# check — compare a target repo against what was applied to it.
#
# Reports three things per pattern:
#   drift    a file was edited locally after being applied (usually fine —
#            it just means `apply --force` would clobber your changes)
#   missing  a file that was applied is now gone
#   stale    the pattern has a newer version in this repo than what landed

cmd_check() {
  local target="."
  while [ $# -gt 0 ]; do
    case "$1" in
      --target) target="$2"; shift 2 ;;
      *) die "check: unknown flag '$1'" ;;
    esac
  done
  target=$(cd -- "$target" && pwd)
  local db="$target/.agentic/applied.json"
  [ -f "$db" ] || die "no patterns applied in $target (looked for .agentic/applied.json)"

  local rc=0 id applied_v current_v path want got
  while read -r id; do
    applied_v=$(jq -r --arg i "$id" '.patterns[$i].version' "$db")
    if [ -f "$PATTERNS_DIR/$id/pattern.json" ]; then
      current_v=$(jq -r .version "$PATTERNS_DIR/$id/pattern.json")
    else
      current_v="(removed upstream)"
    fi

    local status="$C_OK ok $C_0"
    if [ "$applied_v" != "$current_v" ]; then
      status="$C_WARN stale $C_0"
      rc=1
    fi
    printf '%s%-28s%s applied v%s  upstream v%s %b\n' "$C_B" "$id" "$C_0" "$applied_v" "$current_v" "$status"

    while read -r path; do
      [ -n "$path" ] || continue
      want=$(jq -r --arg i "$id" --arg p "$path" \
        '.patterns[$i].files[] | select(.path==$p) | .sha256' "$db")
      if [ ! -f "$target/$path" ]; then
        printf '    %smissing%s %s\n' "$C_ERR" "$C_0" "$path"; rc=1; continue
      fi
      got=$(sha256 "$target/$path")
      if [ "$got" != "$want" ]; then
        printf '    %sdrift%s   %s\n' "$C_WARN" "$C_0" "$path"
      fi
    done < <(jq -r --arg i "$id" '.patterns[$i].files[].path' "$db")
  done < <(jq -r '.patterns | keys[]' "$db")

  return $rc
}
