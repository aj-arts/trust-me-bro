# Trust me bro report

The report is three pages. `trust-me-bro-report.tex` is the editable source, and `trust-me-bro-report.pdf` is the compiled report.

The prose was rewritten with PI 0.80.3 using OpenRouter's `~anthropic/claude-fable-latest` model alias. The user's full pasted Unslop skill was supplied directly as appended system instructions. The rewrite received a factual review and a final correction pass through the same model.

Keep the `images` directory beside the LaTeX file when uploading to Overleaf or copying the source. Both illustrations were made with the built-in ChatGPT image generator. The image prompts are in `images/README.md`.

To compile from this directory with a standard TeX Live installation:

```sh
pdflatex -interaction=nonstopmode -halt-on-error trust-me-bro-report.tex
pdflatex -interaction=nonstopmode -halt-on-error trust-me-bro-report.tex
```

The source also supports compilation from the repository root using the command at the top of the LaTeX file.
