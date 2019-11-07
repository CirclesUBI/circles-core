# Circles Core

<p>
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
  graphNodeEndpoint: 'https://..',
  usernameServiceEndpoint: 'https://..',
  relayServiceEndpoint: 'https://..',
  subgraphName: '...',
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
const network = await core.trust.getNetwork(account, { safeAddress });

// Resolve public addresses to user profiles
const users = await core.user.resolve(account, {
  addresses: network.map(connection => connection.safeAddress),
});

// Example: Display our trust network
network.forEach(connection => {
  const user = users.find(item => item.safeAddress === connection.safeAddress);

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
} else {
  // Deploy Safe
  await core.safe.deploy(account, { safeAddress });

  // Deploy Circles Token
  await core.token.signup(account, { safeAddress });
}

// Change trust state with users
await core.trust.removeConnection(account, {
  from: safeAddress,
  to: users[0].safeAddress,
});

await core.trust.addConnection(account, {
  from: safeAddress,
  to: users[0].safeAddress,
  limitPercentage: 20,
});

// Get list of my activities
const activities = await core.activity.getActivities(account, {
  safeAddress,
});

// Example: Display activities
activities.forEach(activity => {
  const { timestamp, type, data } = activity;

  if (type === 'transfer') {
    console.log(`${timestamp} - ${data.from} transferred ${data.value} Circles to ${data.to} through ${data.through} users`);
  } else if (type === 'addConnection') {
    console.log(`${timestamp} - ${data.limitPercentage} ${data.from} trusted ${data.to}`);
  } else if (type === 'removeConnection') {
    console.log(`${timestamp} - ${data.from} untrusted ${data.to}`);
  } else if (type === 'addOwner') {
    console.log(`${timestamp} - ${data.from} added ${data.ownerAddress} to ${data.safeAddress}`);
  } else if (type === 'removeOwner') {
    console.log(`${timestamp} - ${data.from} removed ${data.ownerAddress} from ${data.safeAddress}`);
  }
});

// Get current balance of all owned Circles Tokens
const tokenAddress = core.token.getAddress(account, {
  safeAddress,
});

const balance = await core.token.getBalance(account, {
  safeAddress,
});

// Transfer Circles to users (directly or transitively)
await core.token.transfer(account, {
  from: safeAddress,
  to: users[0].safeAddress,
  value: 350,
});

// Get current Safe owners
await core.safe.getOwners(account, {
  safeAddress,
});

// .. or get the Safe connected to an owner
const safeAddress = await core.safe.getAddress(account, {
  ownerAddress: '0x123...',
});

// Manage owners of my Safe
await core.safe.removeOwner(account, {
  safeAddress,
  ownerAddress: '0x123...',
});

await core.safe.addOwner(account, {
  safeAddress,
  ownerAddress: '0x123...',
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
