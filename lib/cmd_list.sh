cmd_list() {
  local f_domain="" f_stack="" f_status=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) f_domain="$2"; shift 2 ;;
      --stack)  f_stack="$2";  shift 2 ;;
      --status) f_status="$2"; shift 2 ;;
      *) die "list: unknown flag '$1'" ;;
    esac
  done

  local id domain status stacks summary
  local last_domain=""
  while read -r id; do
    domain="${id%%/*}"
    if [ -n "$f_domain" ] && [ "$domain" != "$f_domain" ]; then continue; fi
    status=$(manifest "$id" | jq -r '.status')
    stacks=$(manifest "$id" | jq -r '.stacks | join(",")')
    summary=$(manifest "$id" | jq -r '.summary')
    if [ -n "$f_status" ] && [ "$status" != "$f_status" ]; then continue; fi
    if [ -n "$f_stack" ]; then
      manifest "$id" | jq -e --arg s "$f_stack" '.stacks | index($s)' >/dev/null || continue
    fi
    if [ "$domain" != "$last_domain" ]; then
      printf '\n%s%s%s\n' "$C_B" "$domain" "$C_0"
      last_domain="$domain"
    fi
    printf '  %-26s %s%-12s%s %s\n' "${id#*/}" "$C_DIM" "[$status]" "$C_0" "$summary"
  done < <(all_pattern_ids)
  printf '\n%sRun: agentic show <domain/name>%s\n' "$C_DIM" "$C_0"
}
