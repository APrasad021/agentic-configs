# {{PROJECT_NAME}}

One paragraph: what this does and who it is for. Write this before anything
else — if you cannot, the project is not scoped yet.

## Quickstart

```bash
make bootstrap   # install deps, create .env
make dev         # run it
make check       # everything CI runs
```

## How it works

A short map of the codebase. Enough that a newcomer — or an agent — knows
which directory to open, not a tour of every file.

```
src/
  ai/         provider gateway, prompts, evals
  config/     validated environment
```

## Configuration

Every key lives in `.env.example`. Copy it to `.env` and fill it in;
`make bootstrap` does the copy for you.

## Development

| Command | Does |
|---|---|
| `make check` | lint + typecheck + test — the merge gate |
| `make fmt` | rewrite to match the formatter |
| `make eval` | AI evals against the golden set |

See `AGENTS.md` for the conventions this repo expects, including from agents.

## License

MIT
