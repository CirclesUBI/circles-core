import web3 from './web3';

// Private keys taken from: `ganache-cli -e 100000 --gasPrice 1000000000 -i 5777 -d -m 'lake harbor special adult kit wheel leisure fix salmon become eager type'`

const privateKeys = [
  '0x19513e71281a20c0f8cdb431eaaaf0efc1f36dfb8c25fd739b1bb9398fe042c9',
  '0x1dad37f34a3ac8e163be354cfab9f997114f0245eb50e806fbb5d621530273ae',
  '0xe0412df16a7256ce362a921a85baad36b05670a3e57e4a1a194974b557cbac18',
  '0x180520a9ee7adaa32f776667e93e85afc63e29ab50a1961a9e5926da9a28d435',
  '0x13d44062243c429aeec9e4d3a455355cf03465bedd3993d32a522a40521cd31c',
  '0x3c5e78891e919253f02172c876f84ba90a1630676908ae820523d048cf52c715',
  '0xdbed207e86face68a1f3bfd380c925854db6f810fc65eaaec1cf4b147322cc77',
  '0x8828bb861e7caf61a430cfc5d2262ee14320810343f4033b9694887f8c082c6a',
  '0xde2d8f7b17f6936ccc7cfedf9633a9d2226a404c23dd460380f9c39492b1c0ef',
  '0xef3ec42326abe099ffeeb51cce966c9c71b26f27f325eec74959b719005dcf3e',
];

export default function createAccount(accountIndex = 0) {
  return web3.eth.accounts.privateKeyToAccount(privateKeys[accountIndex]);
}
