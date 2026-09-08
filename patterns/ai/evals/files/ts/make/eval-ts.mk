EVAL_TARGETS += ts-eval

ts-eval:
	$(PKG) exec tsx evals/run.ts

.PHONY: ts-eval
