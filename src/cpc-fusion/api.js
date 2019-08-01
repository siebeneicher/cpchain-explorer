const now = require('performance-now');
const config = require('../app/config');
const {python_exe} = require('../app/helper');
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8051', null, {});
//const web3 = new Web3('ws://127.0.0.1:8546', null, {});

const { exec } = require('child_process');
let python;


/*async function call_web3 (action, ...params) {
	return web3.eth.getBlockNumber();
}*/

async function call (action, ...params) {

	// check web3
	//return call_web3();

	if (!python)
		python = await python_exe();

	const t = now();
	const cmd = python + " ./cpc-fusion/api.py " + action + " " + params.join(' ');

	return new Promise ((resolve, reject) => {
		exec(cmd, async function (err, data) {
			//console.log("TIME API EXEC:", cmd, /*err, data,*/ (now()-t).toFixed(2), "ms");

			if (err) console.error(cmd, err);

			if (err)
				return reject(err);

			try {
				const json = JSON.parse(data);
				if (json.error)
					reject(json.error);
				else
					resolve(json);
			} catch (err) {
				//console.log(err, data)
				reject(err);
			}
		});
	});
}

async function rnodes () {
	return call('rnodes');
}
async function versions () {
	return call('versions');
}
async function generation (mustBlockNum = null) {
	return call('generation').then(gen => {
		if (mustBlockNum === null) return gen;
		if (gen.BlockNumber == mustBlockNum) return gen;		// validate block number
		return null;
	});
}
async function block (num = null) {
	return call('block', num);
}
async function transaction (txn) {
	try {
		return await call('transaction', txn);
	} catch (err) {
		console.error("Error getting transaction ("+txn+"): ", err);
		return Promise.reject(err);
	}
}
async function balance (addr, blockNum = "") {
	try {
		let {balance} = await call('balance', addr, blockNum);
		return Promise.resolve(balance);
	} catch (err) {
		console.error("Error getting balance ("+addr+"): ", err);
		return Promise.reject(err);
	}
	
}

async function blockNumber () {
	return call('blockNumber');
}

async function perfTest () {

	//await _t1();
	//await _t2();
	//await _t3();
	await _t4();

	return Promise.resolve();


	async function _t1 () {
		let t = now();

		// 1. test 10 sequential mixed API requests
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446");
		await block();
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f");
		await generation();
		await versions();
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5");
		await rnodes();

		console.log("api perfTest.t1:", now()-t);

		return Promise.resolve();
	}

	async function _t2 () {
		let t = now();

		// 1. test 10 parallel mixed API requests
		return Promise.all([
			balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
			,block()
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
			,generation()
			,versions()
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
			,rnodes()
		]).then(() => {
			console.log("api perfTest.t2:", now()-t);
		});
	}

	async function _t3 () {
		let t = now();

		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		await balance("0x8d16Adafb4633A3956691aA4636B603e8F328446")
		await balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f")
		await balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5")
		console.log("api perfTest.t3:", now()-t);

		return Promise.resolve();
	}

	async function _t4 () {
		let t = now();

		return Promise.all([
			balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
			,balance("0x8d16Adafb4633A3956691aA4636B603e8F328446").then(() => console.log(now()-t))
			,balance("0xc46C4Db4855848bBb471BB847DcA4936D8E1254f").then(() => console.log(now()-t))
			,balance("0x4af2267A69d56358d0a861B4592F2bF39036e4E5").then(() => console.log(now()-t))
		]).then(() => {
			console.log("api perfTest.t4:", now()-t);
		});
	}

}

module.exports = {blockNumber, rnodes, versions, generation, block, transaction, balance, web3, perfTest};


/*
const rpc = require("ethrpc");
const connectionConfiguration = {
  httpAddresses: ["http://127.0.0.1:8051"], // optional, default empty array
  wsAddresses: [], // optional, default empty array
  ipcAddresses: [], // optional, default empty array
  //networkID: 3, // optional, used to verify connection to the intended network (blockchain)
  connectionTimeout: 3000, // optional, default 3000
  errorHandler: function (err) { }, // optional, used for errors that can't be correlated back to a request
};
rpc.connect(connectionConfiguration, function (err) {
  if (err) {
    console.error("Failed to connect to Ethereum node.", err);
  } else {
    console.log("Connected to Ethereum node!");
  }
});
*/