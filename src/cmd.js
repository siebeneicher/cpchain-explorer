const {dashboard, aggregate, updateAll} = require('./app/middleware');
const {python_exe} = require('./app/helper');
const {versions} = require('./cpc-fusion/api');

setTimeout(async () => {
	/*await aggregate.reset();
	await aggregate.run();
	await aggregate.test();*/

	await dashboard.update();

	//await dashboard.update();
	//console.log(await python_exe());
	//console.log(await versions());

	process.exit()
}, 1500);
