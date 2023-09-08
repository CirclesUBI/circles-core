# Releasing `circles-core`

Use this checklist to create a new release of `circles-core` and publish the NodeJS package to the public npm registry. All steps are intended to be run from the root directory of the repository.

## Creating a new release

1. Make sure you are currently on the `main` branch, otherwise run `git checkout main`.
2. `git pull` to make sure you haven’t missed any last-minute commits. After this point, nothing else is making it into this version.
3. `npm test` to ensure that all tests pass locally. Note that the local env must be ready (see [`circles-docker` repository](https://github.com/CirclesUBI/circles-docker)).
4. `git push` and verify all tests pass on all CI services.
5. Read the git history since the last release, for example via `git --no-pager log --oneline --no-decorate v2.10.10^..origin/main` (replace `v2.10.10` with the last published version).
6. Create a git and npm tag based on [semantic versioning](https://semver.org/) using `npm version [major | minor | patch]`.
7. `git push origin main --tags` to push the tag to GitHub.
8. `git push origin main` to push the automatic `package.json` change after creating the tag.
9. [Create](https://github.com/CirclesUBI/circles-core/releases/new) a new release on GitHub, select the tag you've just pushed under *"Tag version"* and use the same for the *"Release title"*. For *"Describe this release"* make sure all the important information is there. Correct typos and re-word commits if necessary. See examples [here](https://github.com/CirclesUBI/circles-core/releases).

## Deploy package on npm

1. Run `npm run build` to build a publishable version of the library in the `lib` folder.
2. Make sure you have an [authenticated npm account](https://docs.npmjs.com/cli/v7/commands/npm-adduser) with permission to deploy the `@circles/core` package.
3. Run `npm publish` to finally release the package on npm.
