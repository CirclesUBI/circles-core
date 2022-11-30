export default function encodeMultiSendCall(web3, txs, multiSend) {
  const joinedTxs = txs
    .map((tx) =>
      [
        web3.eth.abi.encodeParameter('uint8', 0).slice(-2),
        web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
        // if you pass wei as number, it will overflow
        web3.eth.abi.encodeParameter('uint256', tx.value.toString()).slice(-64),
        web3.eth.abi
          .encodeParameter('uint256', web3.utils.hexToBytes(tx.data).length)
          .slice(-64),
        tx.data.replace(/^0x/, ''),
      ].join(''),
    )
    .join('');

  const joinedTxsHex = `0x${joinedTxs}`;
  return multiSend.methods.multiSend(joinedTxsHex).encodeABI();
}
