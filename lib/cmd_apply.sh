# apply — copy a pattern's files into a target repo, substituting declared vars,
# then record the result in <target>/.agentic/applied.json.
#
# Only variables the manifest declares are substituted, so a template can still
# contain literal ${{ ... }} (GitHub Actions) or {{ ... }} (Jinja, Handlebars)
# without being mangled.

cmd_apply() {
  local id="" target="." want_stack="" force=0 dry=0
  local -a var_args=()

  while [ $# -gt 0 ]; do
    case "$1" in
      --target)  target="$2"; shift 2 ;;
      --stack)   want_stack="$2"; shift 2 ;;
      --var)     var_args+=("$2"); shift 2 ;;
      --force)   force=1; shift ;;
      --dry-run) dry=1; shift ;;
      -*) die "apply: unknown flag '$1'" ;;
      *) if [ -z "$id" ]; then id="$1"; else die "apply: unexpected argument '$1'"; fi; shift ;;
    esac
  done
  [ -n "$id" ] || die "usage: agentic apply <domain/name> [--target DIR]"

  local dir m; dir=$(pattern_dir "$id"); m=$(manifest "$id")
  [ -d "$target" ] || die "target directory does not exist: $target"
  target=$(cd -- "$target" && pwd)

  # Dependencies are advisory: composition beats copying the same file twice.
  local dep
  while read -r dep; do
    [ -n "$dep" ] || continue
    if [ ! -f "$target/.agentic/applied.json" ] || \
       ! jq -e --arg d "$dep" '.patterns[$d]' "$target/.agentic/applied.json" >/dev/null 2>&1; then
      warn "note: '$id' expects '$dep' — consider: agentic apply $dep --target $target"
    fi
  done < <(jq -r '.requires[]?' <<<"$m")

  # --- resolve stacks -------------------------------------------------------
  local -a stacks=(_common)
  local declared; declared=$(jq -r '.stacks[]' <<<"$m")
  if [ "$want_stack" = "all" ]; then
    while read -r s; do stacks+=("$s"); done <<<"$declared"
  elif [ -n "$want_stack" ]; then
    if ! jq -e --arg s "$want_stack" '.stacks | index($s)' >/dev/null <<<"$m"; then
      if [ -z "$declared" ]; then
        die "pattern '$id' is language-neutral — it ships no stack variants, so drop --stack"
      fi
      die "pattern '$id' has no '$want_stack' variant (ships: $(tr '\n' ' ' <<<"$declared"))"
    fi
    stacks+=("$want_stack")
  else
    local detected; detected=$(detect_stacks "$target")
    while read -r s; do
      if grep -qx "$s" <<<"$detected"; then stacks+=("$s"); fi
    done <<<"$declared"
  fi

  # --- resolve vars ---------------------------------------------------------
  # Defaults come from the manifest; {{PROJECT_NAME}} falls back to the target
  # directory name so the common case needs no flags at all.
  local -a sed_args=()
  local -a resolved=()
  local k default val
  while read -r k; do
    [ -n "$k" ] || continue
    default=$(jq -r --arg k "$k" '.vars[$k].default // ""' <<<"$m")
    if [ "$k" = "PROJECT_NAME" ] && [ -z "$default" ]; then default=$(basename "$target"); fi
    val="$default"
    local pair
    for pair in ${var_args+"${var_args[@]}"}; do
      case "$pair" in "$k="*) val="${pair#*=}" ;; esac
    done
    [ -n "$val" ] || die "apply: required var $k has no default; pass --var $k=<value>"
    sed_args+=(-e "s|{{$k}}|$(sed_e_escape "$val")|g")
    resolved+=("$k=$val")
  done < <(jq -r '.vars | keys[]?' <<<"$m")

  # --- copy -----------------------------------------------------------------
  local -a written=() skipped=()
  local stack src rel dest
  for stack in "${stacks[@]}"; do
    [ -d "$dir/files/$stack" ] || continue
    while IFS= read -r src; do
      rel="${src#"$dir/files/$stack/"}"
      dest="$target/$rel"
      if [ -e "$dest" ] && [ "$force" -eq 0 ]; then
        skipped+=("$rel")
        continue
      fi
      if [ "$dry" -eq 0 ]; then
        mkdir -p "$(dirname "$dest")"
        if is_text "$src" && [ ${#sed_args[@]} -gt 0 ]; then
          sed "${sed_args[@]}" "$src" > "$dest"
        else
          cp "$src" "$dest"
        fi
        if [ -x "$src" ]; then chmod +x "$dest"; fi
      fi
      written+=("$rel")
    done < <(find "$dir/files/$stack" -type f)
  done

  # --- report + record ------------------------------------------------------
  local f
  for f in ${written+"${written[@]}"}; do printf '  %s+%s %s\n' "$C_OK" "$C_0" "$f"; done
  for f in ${skipped+"${skipped[@]}"}; do printf '  %s=%s %s %s(exists — rerun with --force to overwrite)%s\n' "$C_WARN" "$C_0" "$f" "$C_DIM" "$C_0"; done

  if [ "$dry" -eq 1 ]; then
    printf '\n%sdry run — nothing written%s\n' "$C_DIM" "$C_0"
    return 0
  fi

  record_applied "$target" "$id" "$m" "$(printf '%s\n' ${written+"${written[@]}"})" \
    "$(printf '%s\n' "${stacks[@]}")" "$(printf '%s\n' ${resolved+"${resolved[@]}"})"

  printf '\n%s%s%s applied to %s (%d written, %d skipped)\n' \
    "$C_B" "$id" "$C_0" "$target" "${#written[@]}" "${#skipped[@]}"

  if jq -e '.next | length > 0' >/dev/null <<<"$m"; then
    printf '\n%snext:%s\n' "$C_B" "$C_0"
    jq -r '.next[] | "  - " + .' <<<"$m"
  fi
}

# Escape a value for safe use on the right-hand side of a sed s||| expression.
sed_e_escape() { printf '%s' "$1" | sed -e 's|[\\&|]|\\&|g'; }

record_applied() {
  local target="$1" id="$2" m="$3" files="$4" stacks="$5" vars="$6"
  local db="$target/.agentic/applied.json"
  mkdir -p "$target/.agentic"
  [ -f "$db" ] || echo '{"schema":1,"patterns":{}}' > "$db"

  local entries="[]" f sum
  while read -r f; do
    [ -n "$f" ] || continue
    sum=$(sha256 "$target/$f")
    entries=$(jq --arg p "$f" --arg s "$sum" '. + [{path:$p, sha256:$s}]' <<<"$entries")
  done <<<"$files"

  local tmp; tmp=$(mktemp)
  jq --arg id "$id" \
     --arg version "$(jq -r .version <<<"$m")" \
     --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     --argjson files "$entries" \
     --argjson stacks "$(printf '%s' "$stacks" | jq -R 'select(length>0)' | jq -s .)" \
     --argjson vars "$(printf '%s' "$vars" | jq -R 'select(length>0) | split("=") | {(.[0]): (.[1:] | join("="))}' | jq -s 'add // {}')" \
     '.patterns[$id] = {version:$version, appliedAt:$at, stacks:$stacks, vars:$vars, files:$files}' \
     "$db" > "$tmp" && mv "$tmp" "$db"
}
