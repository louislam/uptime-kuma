# Uptime Kuma Review Guidelines

> [!NOTE]
> These review guidelines are a work in progress, and are frequently
> updated and improved, so please check back frequently for the latest version.

## Preparing for a PR Review

### Read the PR description carefully

Make sure you understand what the PR is trying to solve or implement. This could
be a bug fix, a new feature, or a refactor.

### Check the linked issues

If the PR has a linked issue, read it to better understand the context and the
reason for the change.

### Check the test coverage

Make sure relevant tests have been added or modified. If the PR adds new
functionality, there should be tests covering the change.

## General Review

### Code formatting and style

Check if the code adheres to the style guidelines of the project. Make sure
there are no unused imports, variables, `console.log` for debugging in the PR.

- [Project Style](../CONTRIBUTING.md#project-styles)
- [Coding Style](../CONTRIBUTING.md#coding-styles)

### Readability and maintainability

Is the code easy to understand for other developers? Make sure complex parts are
explained with comments about **_why_** something is done, and use clear names
to show **_how_**. Are variables and functions well-named, and is there a
consistent naming style? Also, check if the code is maintainable:

- Is it unnecessarily complex? Could it be simplified?
- Does it follow the **[Single Responsibility Principle (SRP)]**?

[Single Responsibility Principle (SRP)]: https://www.geeksforgeeks.org/single-responsibility-in-solid-design-principle/

### Documentation

Is the PR well documented? Check if the descriptions of functions, parameters,
and return values are present. Are there any changes needed to the README or
other documentation, for example, if new features or configurations are
introduced?

## Functional Review

### Testing

Ensure that the new code is properly tested. This includes unit tests,
integration tests, and if necessary, end-to-end tests.

### Test results

Did all tests pass in the CI pipeline (e.g., GitHub Actions, Travis, CircleCI)?

### Testing in different environments

If the changes depend on certain environments or configurations, verify that the
code has been tested in various environments (e.g., local development, staging,
production).

- [How to test Pull Requests](https://github.com/louislam/uptime-kuma/wiki/Test-Pull-Requests)

### Edge cases and regressions

- Are there test cases for possible edge cases?
- Could this change introduce regressions in other parts of the system?

## Security

### Security issues

Check for potential security problems, such as SQL injection, XSS attacks, or
unsafe API calls. Are there passwords, tokens, or other sensitive data left in
the code by mistake?

### Authentication and authorization

Is access to sensitive data or functionality properly secured? Check that the
correct authorization and authentication mechanisms are in place.

### Security Best Practices

- Ensure that the code is free from common vulnerabilities like **SQL
    injection**, **XSS attacks**, and **insecure API calls**.
- Check for proper encryption of sensitive data, and ensure that **passwords**
    or **API tokens** are not hardcoded in the code.

## Performance

### Performance impact

Check if the changes negatively impact performance. This can include factors
like load times, memory usage, or other performance aspects.

### Use of external libraries

- Have the right libraries been chosen?
- Are there unnecessary dependencies that might reduce performance or increase
    code complexity?
- Are these dependencies actively maintained and free of known vulnerabilities?

### Performance Best Practices

- **Measure performance** using tools like Lighthouse or profiling libraries.
- **Avoid unnecessary dependencies** that may bloat the codebase.
- Ensure that the **code does not degrade the user experience** (e.g., by
    increasing load times or memory consumption).

## Compliance and Integration

### Alignment with the project

Are the changes consistent with the project goals and requirements? Ensure the
PR aligns with the architecture and design principles of the project.

### Integration

If the PR depends on other PRs or changes, verify that they integrate well with
the rest of the project. Ensure the code does not cause conflicts with other
active PRs.

### Backward compatibility

Does the change break compatibility with older versions of the software or
dependencies? If so, is there a migration plan in place?

## Logging and Error Handling

### Proper error handling

- Are errors properly caught and handled instead of being silently ignored?
- Are exceptions used appropriately?

### Logging

- Is sufficient logging included for debugging and monitoring?
- Is there excessive logging that could affect performance?

## Accessibility (for UI-related changes)

If the PR affects the user interface, ensure that it meets accessibility
standards:

- Can users navigate using only the keyboard?
- Are screen readers supported?
- Is there proper color contrast for readability?
- Are there **WCAG** (Web Content Accessibility Guidelines) compliance issues?
- Use tools like **Axe** or **Lighthouse** to evaluate accessibility.

## Providing Feedback

### Constructive feedback

Provide clear, constructive feedback on what is good and what can be improved.
If improvements are needed, be specific about what should change.

### Clarity and collaboration

Ensure your feedback is friendly and open, so the team member who submitted the
PR feels supported and motivated to make improvements.

<details><summary><b>For Maintainers only</b> (click to expand)</summary>
<p>

## Go/No-Go Decision

### Go

If the code has no issues and meets the project requirements, approve it (and
possibly merge it).

### No-Go

If there are significant issues, such as missing tests, security
vulnerabilities, or performance problems, request the necessary changes before
the PR can be approved. Some examples of **significant issues** include:

- Missing tests for new functionality.
- Identified **security vulnerabilities**.
- Code changes that break **backward compatibility** without a proper migration
    plan.
- Code that causes **major performance regressions** (e.g., high CPU/memory
    usage).

## After the Review

### Reordering and merging

Once the necessary changes have been made and the PR is approved, the code can
be merged into the main branch (e.g., `main` or `master`).

### Testing after merging

Ensure that the build passes after merging the PR, and re-test the functionality
in the production environment if necessary.

## Follow-up

### Communication with team members

If the PR has long-term technical or functional implications, communicate the
changes to the team.

### Monitoring

Continue monitoring the production environment for any unexpected issues that
may arise after the code has been merged.

</p>
</details>

---

This process ensures that PRs are systematically and thoroughly reviewed,
improving overall code quality.
