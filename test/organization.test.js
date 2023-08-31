import createCore from './helpers/core';
import getAccounts from './helpers/getAccounts';
import generateSaltNonce from './helpers/generateSaltNonce';
import setupWeb3 from './helpers/setupWeb3';
import setupAccountManual from './helpers/setupAccountManual';

describe('Organization', () => {
  const { web3, provider } = setupWeb3();
  const core = createCore(web3);
  const [account, otherAccount] = getAccounts(web3);
  // let account;
  // let otherAccount;
  let safeAddress;
  // let otherSafeAddress;
  // let otherUserSafeAddress;

  afterAll(() => provider.engine.stop());
  beforeAll(async () => {
    // Deploy safeAddress and otherSafeAddress for organisations
    [safeAddress] = await Promise.all([
      setupAccountManual({ account, nonce: generateSaltNonce() }, core),
      setupAccountManual(
        { account: otherAccount, nonce: generateSaltNonce() },
        core,
      ),
    ]);
  });

  it('should create an organization and return true if it exists', async () => {
    // isOrganization should be false in the beginning
    let isOrganization = await core.organization.isOrganization(account, {
      safeAddress,
    });
    expect(isOrganization).toBe(false);

    // Wait until organisation is deployed
    await core.organization.deploy(account, {
      safeAddress,
    });

    // isOrganization should be true now
    isOrganization = await core.utils.loop(
      () => {
        return core.organization.isOrganization(account, {
          safeAddress,
        });
      },
      (isOrg) => isOrg,
      { label: 'Wait for newly added address to show up as Safe owner' },
    );
    expect(isOrganization).toBe(true);
  });
});

//   it('should prefund the organization so it can pay for its transactions', async () => {
//     const value = 3;

//     await core.organization.prefund(account, {
//       from: userSafeAddress,
//       to: safeAddress,
//       value: web3.utils.toBN(web3.utils.toWei(value.toString(), 'ether')),
//     });

//     const expectedValue = web3.utils.toBN(
//       web3.utils.toWei(value.toString(), 'ether'),
//     );

//     const result = await core.utils.loop(
//       async () => {
//         return await core.token.listAllTokens(account, {
//           safeAddress,
//         });
//       },
//       (tokens) => {
//         return tokens.length > 0 && tokens[0].amount.eq(expectedValue);
//       },
//       { label: 'Wait for organization to own some ether' },
//     );

//     expect(result[0].amount.eq(expectedValue)).toBe(true);
//   });

//   it('should use the funds to execute a transaction on its own', async () => {
//     const txHash = await core.safe.addOwner(account, {
//       safeAddress,
//       ownerAddress: web3.utils.toChecksumAddress(web3.utils.randomHex(20)),
//     });

//     expect(web3.utils.isHexStrict(txHash)).toBe(true);
//   });

//   it('should be able to trust a user as an organization', async () => {
//     const txHash = await core.trust.addConnection(account, {
//       user: otherUserSafeAddress,
//       canSendTo: safeAddress,
//       limitPercentage: 44,
//     });

//     expect(web3.utils.isHexStrict(txHash)).toBe(true);
//   });
// });
