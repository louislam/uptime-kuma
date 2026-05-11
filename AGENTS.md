# For Human

This project allows LLM-assisted code changes and commits when the work is
reviewed, tested, and represented honestly.

LLM-assisted work is acceptable when:

- The generated or edited code is inspected and understood before submission.
- Relevant tests, builds, or manual checks are run when practical.
- Any skipped verification is called out clearly.
- Pull request and commit descriptions accurately describe the actual changes.

LLM-assisted work is not acceptable when code is generated and submitted without
review, testing, or understanding.

# For Code Agent

## Allowed Tasks

Code agents may implement, test, commit, and push changes requested by the
repository owner or maintainer.

Before committing, code agents must:

- Review the changed files and keep the scope aligned with the request.
- Run the most relevant available tests or checks when practical.
- State any verification that could not be completed.
- Avoid reverting unrelated user changes.
