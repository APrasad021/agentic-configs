EVAL_TARGETS += py-eval

py-eval:
	$(PY) python -m evals.run

.PHONY: py-eval
