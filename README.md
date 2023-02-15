<div align="center">
	<img width="80" src="https://raw.githubusercontent.com/CirclesUBI/.github/main/assets/logo.svg" />
</div>

<h1 align="center">circles-core</h1>

<div align="center">
 <strong>
   Common methods to interact with the Circles ecosystem
 </strong>
</div>

<br />

<div align="center">
  <!-- npm -->
  <a href="https://www.npmjs.com/package/@circles/core">
    <img src="https://img.shields.io/npm/v/@circles/core?style=flat-square&color=%23f14d48" height="18">
  </a>
  <!-- Licence -->
  <a href="https://github.com/CirclesUBI/circles-core/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/CirclesUBI/circles-core?style=flat-square&color=%23cc1e66" alt="License" height="18">
  </a>
  <!-- CI status -->
  <a href="https://github.com/CirclesUBI/circles-core/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/workflow/status/CirclesUBI/circles-core/Run%20tests?label=tests&style=flat-square&color=%2347cccb" alt="CI Status" height="18">
  </a>
  <!-- Discourse -->
  <a href="https://aboutcircles.com/">
    <img src="https://img.shields.io/discourse/topics?server=https%3A%2F%2Faboutcircles.com%2F&style=flat-square&color=%23faad26" alt="chat" height="18"/>
  </a>
  <!-- Twitter -->
  <a href="https://twitter.com/CirclesUBI">
    <img src="https://img.shields.io/twitter/follow/circlesubi.svg?label=twitter&style=flat-square&color=%23f14d48" alt="Follow Circles" height="18">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://circlesubi.github.io/circles-core/">
      API Docs
    </a>
    <span> | </span>
    <a href="https://handbook.joincircles.net">
      Handbook
    </a>
    <span> | </span>
    <a href="https://github.com/CirclesUBI/circles-core/releases">
      Releases
    </a>
    <span> | </span>
    <a href="https://github.com/CirclesUBI/.github/blob/main/CONTRIBUTING.md">
      Contributing
    </a>
  </h3>
</div>

<br/>

This library provides common methods for JavaScript clients and wallets to interact with the [`circles-contracts`] and off-chain services.

[`circles-contracts`]: https://github.com/CirclesUBI/circles-contracts

## Features

- Interact with [`circles-contracts`] and off-chain services like [`safe-relay-service`], [`graph`] and [`circles-api`]
- Register and maintain user accounts and organizations
- Create and search off-chain data like transfer descriptions, usernames and profile pictures
- Trust other users in the network and retreive trust network
- List owned Circles tokens and their current balance
- Show last activities like transfers, trusts and Safe ownership changes
- Calculate transitive transfer steps to send Circles
- Update the Version of the Safe contract to `v1.3.0`

[`safe-relay-service`]: https://github.com/CirclesUBI/safe-relay-service
[`graph`]: https://thegraph.com/explorer/subgraph/circlesubi/circles
[`circles-api`]: https://github.com/CirclesUBI/circles-api

## Example

```js
import CirclesCore from '@circles/core';
import Web3 from 'web3';

// Initialize web3
const web3 = new Web3();

// Initialize core with default configs when running against local `circles-docker` setup
const core = new CirclesCore(web3, {
  hubAddress: '0xCfEB869F69431e42cdB54A4F4f105C19C080A601',
  proxyFactoryAddress: '0x9b1f7F645351AF3631a656421eD2e40f2802E6c0',
  safeMasterAddress: '0x59d3631c86BbE35EF041872d502F218A39FBa150',
  apiServiceEndpoint: 'http://api.circles.local',
  pathfinderServiceEndpoint: 'http://pathfinder.circles.local'
  graphNodeEndpoint: 'http://graph.circles.local',
  databaseSource: 'graph',
  relayServiceEndpoint: 'http://relay.circles.local',
  subgraphName: 'circlesubi/circles-subgraph',
  fallbackHandlerAddress: '0x67B5656d60a809915323Bf2C40A8bEF15A152e3e',
});

// Create existing account from private key which owns a Safe
const account = web3.eth.accounts.privateKeyToAccount('0x...');

// Find out the address of the owned Safe
const [safeAddress] = await core.safe.getAddresses(account, {
  ownerAddress: account.address,
});

// Request Circles UBI payout
await core.token.requestUBIPayout(account, {
  safeAddress,
});
```

## Installation

```bash
npm i @circles/core
```

Make sure you have all peer dependencies [`isomorphic-fetch`] and [`web3`] installed as well. Check out the [`circles-docker`] repository for running your code locally against Circles services during development.

[`isomorphic-fetch`]: https://www.npmjs.com/package/isomorphic-fetch
[`web3`]: https://www.npmjs.com/package/web3

## Development

`circles-core` is a JavaScript module, tested with [`Jest`], transpiled with [`Babel`] and bundled with [`Rollup`]. Most of the tests are designed to test end-to-end against all external services and require a running [`circles-docker`] environment to work in your development setup.

```bash
# Install NodeJS dependencies
npm install

# Copy config file and edit variables according to your needs.
# When running against the default docker setup no changes are required here
cp .env.example .env

# Run e2e test suite. Make sure services are running in the background
# via `circles-docker` repository
npm run test

# Run tests automatically during development when changes have been made
npm run test:watch

# Check code formatting
npm run lint

# Build it!
npm run build
```

[`jest`]: https://jestjs.io
[`babel`]: https://babeljs.io
[`rollup`]: https://rollupjs.org
[`circles-docker`]: https://github.com/CirclesUBI/circles-docker

## License

GNU Affero General Public License v3.0 [`AGPL-3.0`]

[`agpl-3.0`]: https://github.com/CirclesUBI/circles-core/blob/main/LICENSE
