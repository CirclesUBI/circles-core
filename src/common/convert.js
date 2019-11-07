/**
 * Convert to fractional monetary unit of Circles
 * named Freckles.
 */
export function toFreckles(web3, value) {
  return web3.utils.toWei(`${value}`, 'ether');
}

/**
 * Convert from Freckles to Circles number.
 */
export function fromFreckles(web3, value) {
  return parseInt(web3.utils.fromWei(`${value}`, 'ether'), 10);
}
