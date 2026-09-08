## dev-test: tests in watch mode — the tightest useful loop
dev-test:
	$(PKG) run test -- --watch

.PHONY: dev-test
