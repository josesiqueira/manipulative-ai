---
name: readme-updater
description: >
  README quality skill. Defines best practices for writing clear, useful, and
  well-structured README files. Used by the readme-updater agent to keep the
  project README in sync with the actual state of the code. Trigger whenever
  README updates, documentation generation, or project documentation is involved.
context: fork
---

# README Updater — Best Practices & Conventions

This skill ensures every project has a README that is accurate, useful, and
well-structured — reflecting the actual state of the code, not a stale template.

## README structure

A good README answers these questions in order:

1. **What is this?** (title + one-paragraph description)
2. **What does it look like?** (screenshot or demo link, if UI exists)
3. **How do I use it?** (installation + quick start)
4. **How does it work?** (architecture overview, key concepts)
5. **How do I develop on it?** (dev setup, testing, contributing)
6. **What's the current state?** (status, coverage, known issues)

## Required sections

```markdown
# Project Name

One paragraph: what this project does, who it's for, and what makes it distinctive.

## Quick start

[Minimum steps to get it running — ideally 3 commands or fewer]

## Features

[Bullet list of what's actually implemented, not aspirational]

## Architecture

[Brief overview of how the code is organized. Reference STACK.md values.]
- Language: [from STACK.md]
- Framework: [from STACK.md]
- Testing: [from STACK.md]

## Development

### Prerequisites
[What you need installed]

### Setup
[Step-by-step to get a dev environment running]

### Testing
[How to run tests, what the test coverage looks like]

### Project structure
[Key directories and what they contain]

## Status

[Current state: which phases are complete, test counts, known issues]
[Reference STATUS.md if it exists]

## License

[License type]
```

## Best practices

### Content
- **Accuracy over aspiration.** Only document what exists, not what's planned.
  If a feature isn't implemented yet, don't list it. Use STATUS.md for roadmap.
- **Concrete over vague.** "Calculates compound interest for CDB/LCI/LCA products"
  is better than "Financial calculator tool."
- **Show, don't tell.** Include a code example or screenshot where possible.
- **Keep it current.** The README should be updated every time a phase completes.

### Formatting
- Use ATX-style headers (`#`, `##`, `###`).
- Code blocks with language hints (```bash, ```typescript).
- Tables for structured data (test coverage, feature matrix).
- No excessive badges — only badges that convey useful information
  (build status, test coverage, license).
- No emoji in headers. Minimal emoji overall.
- Short paragraphs. Scannable structure.

### What NOT to include
- Auto-generated boilerplate that doesn't apply to this project.
- "Table of contents" for READMEs under 200 lines.
- Badges for services the project doesn't use.
- "Contributing" section for solo/small-team projects (unless genuinely open source).
- Aspirational features that don't exist yet.

## How the readme-updater agent uses this skill

1. **At Step 5 (before commit)**: reads PLAN.md, STATUS.md, STACK.md, TEST-PLAN.md,
   and the actual source code. Updates README.md to reflect the current state:
   which phases are done, what features work, how to run tests, current architecture.

2. **After Step 6 (final report)**: does a final pass to update the README with
   complete test coverage numbers, final feature list, and deployment instructions.
