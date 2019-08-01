# Circles Core

<p>
  <a href="https://chat.joincircles.net">
    <img src="https://chat.joincircles.net/api/v1/shield.svg?type=online&name=circles%20chat" alt="Chat Server">
  </a>
  <a href="https://opencollective.com/circles">
    <img src="https://opencollective.com/circles/supporters/badge.svg" alt="Backers">
  </a>
  <a href="https://github.com/CirclesUBI/circles-core/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/license-APGLv3-orange.svg" alt="License">
  </a>
  <a href="https://travis-ci.org/CirclesUBI/circles-core">
    <img src="https://api.travis-ci.com/CirclesUBI/circles-core.svg?branch=development" alt="Build Status">
  </a>
  <a href="https://twitter.com/CirclesUBI">
    <img src="https://img.shields.io/twitter/follow/circlesubi.svg?label=follow+circles" alt="Follow Circles">
  </a>
</p>

Common methods (sign up, transfer Circles, trust users, revoke trust) for clients & wallets to interact with the Circles ecosystem (Smart Contracts, Relay Service, Trust Graph API, etc.).

## Requirements

* NodeJS
* web3.js
* Truffle & Ganache
* Python 2.7

## Development

`circles-core` is a JavaScript module written in [TypeScript](https://www.typescriptlang.org/), tested with [Jest](https://jestjs.io/), transpiled with [Babel](https://babeljs.io/) and bundled with [Rollup](https://rollupjs.org).

```
// Install dependencies
npm install

// Run test suite
npm run test
npm run test:watch

// Check type definitions
npm run type-check
npm run type-check:watch

// Check code formatting
npm run lint

// Build it!
npm run build
```

## License

GNU Affero General Public License v3.0 `AGPL-3.0`
