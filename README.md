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
    <img src="https://img.shields.io/npm/v/@circles/core?style=flat-square" height="18">
  </a>
  <!-- Licence -->
  <a href="https://github.com/CirclesUBI/circles-core/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/CirclesUBI/circles-core?style=flat-square" alt="License" height="18">
  </a>
  <!-- CI status -->
  <a href="https://github.com/CirclesUBI/circles-core/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/workflow/status/CirclesUBI/circles-core/Run%20tests?label=tests&style=flat-square" alt="CI Status" height="18">
  </a>
  <!-- Discourse -->
  <a href="https://aboutcircles.com/">
    <img src="https://img.shields.io/discourse/topics?server=https%3A%2F%2Faboutcircles.com%2F&style=flat-square" alt="chat" height="18"/>
  </a>
  <!-- Twitter -->
  <a href="https://twitter.com/CirclesUBI">
    <img src="https://img.shields.io/twitter/follow/circlesubi.svg?label=twitter&style=flat-square" alt="Follow Circles" height="18">
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

This library provides common methods for JavaScript clients and wallets to interact with the Circles smart-contracts and off-chain services.

## Features

- Interact with Circles smart-contracts and off-chain services like the Transaction Relayer, Graph Node and Circles API.
- Register and maintain Circles user accounts and organizations.
- Create and search off-chain data like usernames and profile pictures.
- Trust other users in the network.
- Lists owned Circles tokens and their current balance.
- Calculates transitive transfer steps to send Circles.

## Example

```js
import CirclesCore from '@circles/core';
import Web3 from 'web3';

// Initialize web3
const web3 = new Web3();

// Initialize core
const core = new CirclesCore(web3, {
  hubAddress: '0x..',
  proxyFactoryAddress: '0x..',
  safeMasterAddress: '0x..',
  apiServiceEndpoint: 'https://..',
  graphNodeEndpoint: 'https://..',
  relayServiceEndpoint: 'https://..',
  subgraphName: '...',
});

// Create account which owns Safe
const account = web3.eth.accounts.privateKeyToAccount(SECRET_KEY);

// Find out the address of the owned Safe
const [safeAddress] = await core.safe.getAddresses(account, {
  ownerAddress: account.address,
});

// Request UBI payout
await core.token.requestUBIPayout(account, {
  safeAddress,
});
```

## Installation

```bash
npm i @circles/core
```

Make sure you have all peer dependencies [`isomorphic-fetch`] and [`web3`] installed as well.

[`isomorphic-fetch`]: https://www.npmjs.com/package/isomorphic-fetch
[`web3`]: https://www.npmjs.com/package/web3

## Development

`circles-core` is a JavaScript module, tested with [`Jest`], transpiled with [`Babel`] and bundled with [`Rollup`].

```bash
// Install dependencies
npm install

// Copy config file and edit it
cp .env.example .env

// Run test suite
npm run test
npm run test:watch

// Check code formatting
npm run lint

// Build it!
npm run build
```

[`Jest`]: https://jestjs.io/
[`Babel`]: https://babeljs.io/
[`Rollup`]: https://rollupjs.org

## License

GNU Affero General Public License v3.0 `AGPL-3.0`
