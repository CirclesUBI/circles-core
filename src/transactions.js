import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeContract } from '~/common/getContracts';
import { ZERO_ADDRESS, CALL_OP } from '~/common/constants';

/**
 * Transactions submodule execute tx with the Gnosis Safe.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 *
 * @return {Object} - safe module instance
 */
export default function createTransactionsModule(web3, contracts) {
  return {
    execTransaction: async (account, userOptions) => {
      checkAccount(web3, account);
      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        txData: {
          type: web3.utils.isHexStrict,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        value: {
          type: 'number',
          default: 0,
        },
      });

      const { safeAddress, txData, to, value } = options;
      // Get Safe at given address
      const safeInstance = getSafeContract(web3, options.safeAddress);

      const operation = CALL_OP;
      const gasPrice = 0; // no refund
      const gasToken = ZERO_ADDRESS; // Paying in Eth
      const refundReceiver = ZERO_ADDRESS;
      const nonce = await safeInstance.methods.nonce().call();
      const baseGas = new web3.utils.toBN('0');

      // code from circles.garden
      // const safeTxGas = await web3.eth.estimateGas({to, from: safeAddress, value, data: txData});

      // code from circles.land
      // https://github.com/safe-global/safe-contracts/blob/main/contracts/GnosisSafe.sol#L111
      const safeTxGas = await safeInstance.methods
        .execTransaction(
          to,
          value,
          txData,
          operation,
          safeTxGas,
          baseGas,
          new web3.utils.toBN('0'),
          executableTransaction.gasToken,
          executableTransaction.refundReceiver,
          signatures.signature,
        )
        .estimateGas();

        const baseGas = await EstimateGas.estimateBaseGas(safeInstance, to, value, txData, operation,
        safeTxGas, gasToken, refundReceiver, 1, nonce);

      console.log({ safeTxGas });
        console.log({baseGas});

        const typedData = TypedData.formatTypedData({
            to,
            value,
            txData,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            nonce,
            verifyingContract: safeAddress,
        });
        const signature = TypedData.signTypedData(account.privateKey, typedData);
        const signatures = signature;

        const data = safeInstance.methods
            .execTransaction(
            to,
            value,
            txData,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            signatures,
            )
            .encodeABI();

        const max = Math.floor(Math.max((safeTxGas * 64) / 63, safeTxGas + 2500) + 500);
        const gasLimit = safeTxGas + baseGas + max;
        
        const tx = await signAndSendRawTransaction(account, safeInstance.options.address, data, gas=gasLimit);
        return tx;
},
};
}