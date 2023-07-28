const { provider } = require('./test/helpers/web3');

module.exports = () => provider.engine.stop();
