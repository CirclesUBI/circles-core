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

## Usage

```js
import CirclesCore from 'circles-core';
import Web3 from 'web3';

const web3 = new Web3();

// Initialize core
const core = new CirclesCore(web3, {
  hubAddress: '0x..',
  proxyFactoryAddress: '0x..',
  safeMasterAddress: '0x..',
  usernameServiceEndpoint: 'https://..',
  relayServiceEndpoint: 'https://..',
});

// Create account
const account = web3.eth.accounts.create();

// Define nice username for us
const username = 'margareth';

// Generate a nonce to predict Safe address
const nonce = new Date().getTime();

// Prepare Safe deployment and receive a predicted safeAddress
const safeAddress = await core.safe.prepareDeploy(account, { nonce });

// Register username and connect it to Safe address
await core.user.register(account, {
  nonce,
  safeAddress,
  username,
});

// Get our current trust network
const network = await core.trust.getNetwork(account, { address: safeAddress });

// Resolve public addresses to user profiles
const users = await core.user.resolve(account, {
  addresses: network.map(connection => connection.address),
});

// Example: Display our trust network
network.forEach(connection => {
  const user = users.find(item => item.address === connection.address);

  if (connection.isTrustingMe) {
    console.log(`${user.username} trusts you.`);
  }

  if (connection.isTrustedByMe) {
    console.log(`You trust ${user.username}.`);
  }
});

// Check if we have enough trust connections
const trustConnectionLimit = 3;

const isTrusted = network.reduce((acc, connection) => {
  return connection.isTrustingMe ? acc + 1 : acc;
}, 0) > trustConnectionLimit;

if (!isTrusted) {
  console.log('Not enough trust connections yet ..');
}

// Change trust state with users
await core.trust.removeConnection(account, {
  from: safeAddress,
  to: users[0].address,
});

await core.trust.addConnection(account, {
  from: safeAddress,
  to: users[0].address,
  limit: 20,
});

// Get list of my activities
const activities = await core.activity.getActivities(account, {
  address: safeAddress,
});

// Example: Display activities
activities.forEach(activity => {
  const { timestamp, type, data } = activity;

  if (type === 'transfer') {
    console.log(`${timestamp} - ${data.from} transferred ${data.value} Circles to ${data.to} through ${data.through} users`);
  } else if (type === 'addConnection') {
    console.log(`${timestamp} - ${data.limit} ${data.from} trusted ${data.to}`);
  } else if (type === 'removeConnection') {
    console.log(`${timestamp} - ${data.from} untrusted ${data.to}`);
  } else if (type === 'addOwner') {
    console.log(`${timestamp} - ${data.from} added ${data.owner} to ${data.address}`);
  } else if (type === 'removeOwner') {
    console.log(`${timestamp} - ${data.from} removed ${data.owner} from ${data.address}`);
  }
});

// Get my current balance of Circles
const balance = await core.ubi.getBalance(account, {
  address: safeAddress,
});

// Transfer Circles to users (directly or transitively)
await core.ubi.transfer(account, {
  from: safeAddress,
  to: users[0].address,
  value: 350,
});

// Get current Safe owners
await core.safe.getOwners(account, {
  address: safeAddress,
});

// Manage owners of my Safe
await core.safe.removeOwner(account, {
  address: safeAddress,
  owner: '0x123...',
});

await core.safe.addOwner(account, {
  address: safeAddress,
  owner: '0x123...',
});
```

## Development

`circles-core` is a JavaScript module written in JavaScript, tested with [Jest](https://jestjs.io/), transpiled with [Babel](https://babeljs.io/) and bundled with [Rollup](https://rollupjs.org).

```
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

## License

GNU Affero General Public License v3.0 `AGPL-3.0`
