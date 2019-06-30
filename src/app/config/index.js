const def = require('./default');
const production = require('./production');

const env = process.env.NODE_ENV || 'development';

module.exports = Object.assign(def, env == "production" ? production : {});
