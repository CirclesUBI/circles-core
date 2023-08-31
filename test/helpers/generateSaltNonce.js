const { randomUUID } = require('crypto');

const generateSaltNonce = () => Buffer.from(randomUUID()).readUInt32BE(0);

export default generateSaltNonce;
