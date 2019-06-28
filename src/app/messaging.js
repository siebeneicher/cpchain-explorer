const NRP = require('node-redis-pubsub');
const conf = require('./config');

const app_messaging_config = {
  port  : conf.redis.port  , // Port of your locally running Redis server
  scope : conf.redis.scope  // Use a scope to prevent two NRPs from sharing messages
};

module.exports = new NRP(app_messaging_config);		// This is the NRP client
