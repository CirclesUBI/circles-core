import checkOptions from '~/common/checkOptions';

export default function checkAccount(account) {
  return checkOptions(account, ['address', 'privateKey']);
}
