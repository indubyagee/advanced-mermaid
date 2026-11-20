# Contributing to Advanced Mermaid

## Report a bug or suggest a feature

Check for an existing report before opening an issue. If you find one, add any new details there. [GitHub Issues](https://github.com/indubyagee/advanced-mermaid/issues)

A bug report is easiest to reproduce when it includes the following details.

- Your Advanced Mermaid version, Obsidian version, and operating system.
- The steps to reproduce the problem, what you expected, and what happened.
- A small example you can share. For a diagram issue, include the complete `mermaid` or `pele` block and say which view you used. If the plugin shows a diagnostic, select **Copy error** and include the message.

For a feature request, describe what you’re trying to do in Obsidian and where the current workflow falls short.

## Build a development copy

Use Node.js 24 and npm. Clone the repository or your fork, then create a branch from `main`. Run these commands from the repository root.

```sh
npm ci
npm run build
```

Install the generated `main.js`, along with the repository’s `manifest.json` and `styles.css`, in a test vault. Use `npm run dev` to rebuild as you edit. Copy the updated files into the test vault and reload the plugin to try each change. [Manual installation](docs/user-guide.md#install-manually)

## Make and check a change

Keep lifecycle registration in `src/main.ts` and feature code in focused modules under `src/`. Preserve existing command IDs and account for saved preferences when changing settings. Keep rendering and exporting local. [Rendering and editor overview](docs/technical-reference.md#how-a-diagram-renders) · [Obsidian developer policies](https://docs.obsidian.md/community-directory/developer-policies) · [Plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)

For code changes, run the tests, type check, linter, and production build.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

If a change affects rendering, editing, or export, run `npm run test:browser` and try the affected workflow in a desktop Obsidian test vault. The browser fixtures use an Obsidian test adapter. [Browser test setup](docs/technical-reference.md#build-and-test-locally)

For documentation changes, follow the links and check that any examples and control names match the plugin.

Run `npm run check:public` before sharing your branch. Keep generated bundles, dependencies, and files from your test vault out of Git.

## Open a pull request

Open the pull request against `main`. Describe the change and why it’s needed, link any related issue, and report which checks you ran. For manual testing, include the Obsidian version and operating system. Add a screenshot when it helps explain a visual change.

For changes users will notice, add a short entry under **Unreleased** that explains what changed. [Changelog](CHANGELOG.md#unreleased)
