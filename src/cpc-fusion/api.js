const now = require('performance-now');
const config = require('../app/config');
const python_executable = 'C:\\Users\\siebeneicher\\AppData\\Local\\Programs\\Python\\Python37\\python.exe';
// const python_executable = "python3.6";		// unix

const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8051', null, {});
//const web3 = new Web3('ws://127.0.0.1:8546', null, {});

const { exec } = require('child_process');

async function call (action, ...params) {
	const t = now();
	const cmd = python_executable + " ./cpc-fusion/api.py " + action + " " + params.join(' ');

	return new Promise ((resolve, reject) => {
		exec(cmd, async function (err, data) {
			//console.log(cmd, (now()-t).toFixed(2), "ms");

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
	return call('transaction', txn);
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

module.exports = {blockNumber, rnodes, versions, generation, block, transaction, balance, web3};


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