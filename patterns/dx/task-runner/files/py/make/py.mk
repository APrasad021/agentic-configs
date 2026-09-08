# Python fragment. Prefers uv, falls back to the active interpreter.

PY := $(shell if command -v uv >/dev/null 2>&1; then echo "uv run"; else echo python -m; fi)
PYINSTALL := $(shell if command -v uv >/dev/null 2>&1; then echo "uv sync"; else echo "pip install -e '.[dev]'"; fi)

BOOTSTRAP_TARGETS += py-install
DEV_TARGETS       += py-dev
FMT_TARGETS       += py-fmt
LINT_TARGETS      += py-lint
TYPECHECK_TARGETS += py-typecheck
TEST_TARGETS      += py-test
AUDIT_TARGETS     += py-audit
CLEAN_TARGETS     += py-clean

py-install:
	$(PYINSTALL)

py-dev:
	$(PY) uvicorn app.main:app --reload

py-fmt:
	$(PY) ruff format .

py-lint:
	$(PY) ruff check .

py-typecheck:
	$(PY) mypy .

py-test:
	$(PY) pytest -q

py-audit:
	$(PY) pip_audit || true

py-clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache .mypy_cache dist build

.PHONY: py-install py-dev py-fmt py-lint py-typecheck py-test py-audit py-clean
