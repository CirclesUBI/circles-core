import checkOptions from '~/common/checkOptions';

export default function checkAccount(web3, account) {
  return checkOptions(account, {
    address: web3.utils.isHexStrict,
    privateKey: web3.utils.isHexStrict,
  });
}
