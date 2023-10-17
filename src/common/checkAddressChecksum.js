import { ethers } from 'ethers';

const checkAddressChecksum = (address) => {
  const addressHash = ethers.utils.keccak256(
    Buffer.from(address.toLowerCase().replace('0x', ''), 'ascii'),
  );

  for (let i = 0; i < address.length; i++) {
    if (
      (parseInt(addressHash[i], 16) > 7 &&
        address[i].toUpperCase() !== address[i]) ||
      (parseInt(addressHash[i], 16) <= 7 &&
        address[i].toLowerCase() !== address[i])
    ) {
      return false;
    }
  }

  return true;
};

export default checkAddressChecksum;
