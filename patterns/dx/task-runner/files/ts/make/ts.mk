# TypeScript / Node fragment. Uses whatever package manager the lockfile names.

PKG := $(shell \
	if [ -f pnpm-lock.yaml ]; then echo pnpm; \
	elif [ -f yarn.lock ]; then echo yarn; \
	elif [ -f bun.lockb ]; then echo bun; \
	else echo npm; fi)

BOOTSTRAP_TARGETS += ts-install
DEV_TARGETS       += ts-dev
FMT_TARGETS       += ts-fmt
LINT_TARGETS      += ts-lint
TYPECHECK_TARGETS += ts-typecheck
TEST_TARGETS      += ts-test
AUDIT_TARGETS     += ts-audit
CLEAN_TARGETS     += ts-clean

ts-install:
	$(PKG) install

ts-dev:
	$(PKG) run dev

ts-fmt:
	$(PKG) run format

ts-lint:
	$(PKG) run lint

ts-typecheck:
	$(PKG) exec tsc --noEmit

ts-test:
	$(PKG) run test

ts-audit:
	$(PKG) audit --audit-level=high

ts-clean:
	rm -rf dist .turbo node_modules/.cache

.PHONY: ts-install ts-dev ts-fmt ts-lint ts-typecheck ts-test ts-audit ts-clean
