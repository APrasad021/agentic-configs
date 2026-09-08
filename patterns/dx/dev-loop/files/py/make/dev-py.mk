## dev-test: tests in watch mode — the tightest useful loop
dev-test:
	$(PY) pytest-watch -- -q

.PHONY: dev-test
