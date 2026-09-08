cmd_show() {
  local id="${1:?usage: agentic show <domain/name>}"
  local dir; dir=$(pattern_dir "$id")
  local m; m=$(manifest "$id")

  printf '%s%s%s  %sv%s · %s%s\n' "$C_B" "$id" "$C_0" "$C_DIM" \
    "$(jq -r .version <<<"$m")" "$(jq -r .status <<<"$m")" "$C_0"
  printf '%s\n\n' "$(jq -r .summary <<<"$m")"

  printf '%sstacks%s    %s\n' "$C_B" "$C_0" "$(jq -r '.stacks | join(", ")' <<<"$m")"
  local reqs; reqs=$(jq -r '.requires | join(", ")' <<<"$m")
  if [ -n "$reqs" ]; then printf '%srequires%s  %s\n' "$C_B" "$C_0" "$reqs"; fi
  local tools; tools=$(jq -r '.tools | join(", ")' <<<"$m")
  if [ -n "$tools" ]; then printf '%stools%s     %s\n' "$C_B" "$C_0" "$tools"; fi

  if jq -e '.vars | length > 0' >/dev/null <<<"$m"; then
    printf '\n%svars%s\n' "$C_B" "$C_0"
    # jq treats "" as truthy, so an empty default needs an explicit test.
    jq -r '.vars | to_entries[] |
      "  {{\(.key)}}  default: \(if (.value.default // "") == "" then "(see description)" else .value.default end)  — \(.value.description)"' <<<"$m"
  fi

  printf '\n%sfiles%s\n' "$C_B" "$C_0"
  local stack
  for stack in _common $(jq -r '.stacks[]' <<<"$m"); do
    [ -d "$dir/files/$stack" ] || continue
    (cd "$dir/files/$stack" && find . -type f | sed "s|^\./|  [$stack] |") | sort
  done

  printf '\n%s—— README ——%s\n' "$C_DIM" "$C_0"
  cat "$dir/README.md"
}
