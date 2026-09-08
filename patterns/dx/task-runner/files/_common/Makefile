# Standard verb set. Every project gets the same entry points, so CI, agents,
# and humans all invoke work the same way — no one has to read the repo to
# find out how to run the tests.
#
# Language-specific implementations live in make/*.mk and are included below.
# Adding a stack means dropping in a fragment, never editing this file.

.DEFAULT_GOAL := help
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c

PROJECT := {{PROJECT_NAME}}

-include make/*.mk

## bootstrap: install everything a fresh clone needs
bootstrap: env $(BOOTSTRAP_TARGETS)
	@echo "✓ $(PROJECT) ready"

## env: create .env from .env.example if it is missing
env:
	@if [ -f .env.example ] && [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "created .env from .env.example — fill in your keys"; \
	fi

## dev: run the development loop (watch, reload, serve)
dev: $(DEV_TARGETS)

## fmt: rewrite code to match the formatter
fmt: $(FMT_TARGETS)

## lint: report style and correctness problems without rewriting
lint: $(LINT_TARGETS)

## typecheck: static type analysis
typecheck: $(TYPECHECK_TARGETS)

## test: run the test suite
test: $(TEST_TARGETS)

## check: everything CI runs — the one command that gates a merge
check: lint typecheck test

## eval: run AI evals against the golden set (see ai/evals)
eval: $(EVAL_TARGETS)
	@if [ -z "$(EVAL_TARGETS)" ]; then echo "no evals configured — see ai/evals"; fi

## audit: dependency and secret scanning
audit: $(AUDIT_TARGETS)

## clean: remove build output and caches
clean: $(CLEAN_TARGETS)

## help: list available targets
help:
	@echo "$(PROJECT)"
	@echo
	@# awk rather than `column`, which is not installed on every base image
	@# (including most slim CI containers) — `make help` failing is a bad
	@# first impression for the command whose whole job is orientation.
	@grep -hE '^## ' $(MAKEFILE_LIST) \
		| sed 's/^## //' \
		| awk -F': *' '{ printf "  %-14s %s\n", $$1, $$2 }' \
		| sort

.PHONY: bootstrap env dev fmt lint typecheck test check eval audit clean help
