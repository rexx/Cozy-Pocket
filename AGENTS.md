# AGENTS.md

## Commit Message Guidelines

- Commit messages should be more descriptive than a short one-line summary.
- Use a clear subject line plus a body when the change is not trivial.
- The expected level of detail should be similar to this example:

```text
Reduce build warnings by lazy-loading Gemini and splitting vendor chunks

Lazy-load the Gemini parser so AI code is only fetched when needed, replace wildcard lucide imports with an explicit category icon map, and add manual Vite chunking for React, Dexie, date-fns, icons, and AI dependencies.

This removes the 500 kB chunk warning and keeps the production build clean.
```

- The subject line should explain the user-visible or engineering outcome.
- The body should explain the main implementation choices, not just restate the title.
- Include enough context that someone reading `git log` can understand what changed and why without opening the diff immediately.
- For non-trivial changes, aim for:
  - 1 subject line
  - 1 to 2 short body paragraphs
  - concrete mention of the main technical actions taken
- Avoid vague commit messages such as `fix stuff`, `update`, `cleanup`, or `tweak build`.
