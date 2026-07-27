# Contributing

This is proprietary software (see [LICENSE](LICENSE)) — contributions are only
accepted from authorized collaborators.

## Making a change

1. Create a branch off `master`.
2. Make your change. Run the relevant checks locally before opening a PR:
   - `cd server && npm test`
   - `cd web && npm run build`
3. Open a pull request against `master`.

## What has to pass before merge

`master` is a protected branch. A PR can't be merged until:

- The **CI** workflow passes: `server-test`, `web-build`, `extension-lint`
  (see `.github/workflows/ci.yml`)
- It has 1 approving review from a code owner (see `.github/CODEOWNERS`)
- The branch is up to date with `master`

Direct pushes to `master` are blocked for everyone except repo admins.

## Commit messages

Short, present-tense summary of the *why*, not a restatement of the diff.
