const def = require('./default');
const objectAssignDeep = require('object-assign-deep');

let env = process.env.NODE_ENV || 'production';

if (!['production','development','development-prod-db'].includes(env))
	env = 'production';

console.log('ENV:', env);

const merged_conf = objectAssignDeep(def, require('./'+env));

//console.log(merged_conf);

module.exports = merged_conf;
