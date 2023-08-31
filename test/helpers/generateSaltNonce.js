const { randomUUID } = require('crypto');

module.exports = () => Buffer.from(randomUUID()).readUInt32BE(0);
