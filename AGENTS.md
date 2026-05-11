# For Human

This project allows full LLM code generation, LLM-assisted code changes, and
LLM-assisted commits when the work is reviewed, tested, and represented
honestly.

LLM usage is acceptable for any part of the development workflow, including
planning, implementation, refactoring, tests, documentation, commits, and pull
request preparation.

LLM-generated or LLM-assisted work is acceptable when:

- The generated or edited code is inspected and understood before submission.
- Relevant tests, builds, or manual checks are run when practical.
- Any skipped verification is called out clearly.
- Pull request and commit descriptions accurately describe the actual changes.

LLM-generated or LLM-assisted work is not acceptable only when it is submitted
without review, testing when practical, or basic understanding of what changed.

# For Code Agent

## Allowed Tasks

Code agents may implement, test, commit, and push changes requested by the
repository owner or maintainer.

Code agents may generate complete code changes with LLMs. There is no
human-only implementation requirement, provided the final changes are reviewed,
scoped to the request, and verified when practical.

Before committing, code agents must:

- Review the changed files and keep the scope aligned with the request.
- Run the most relevant available tests or checks when practical.
- State any verification that could not be completed.
- Avoid reverting unrelated user changes.
