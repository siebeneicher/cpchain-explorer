const { exec } = require('child_process');
const moment = require('moment');
const config = require('./config');
const sha3 = require('crypto-js/sha3');

/**
 * http://ipfs-sec.stackexchange.cloudflare-ipfs.com/ethereum/A/question/1374.html
 *
 * Checks if the given string is an address
 *
 * @method isAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
*/
var isAddress = function (address) {
    if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        // check if it has the basic requirements of an address
        return false;
    } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
        // If it's all small caps or all all caps, return true
        return true;
    } else {
        // Otherwise check each case
        return isChecksumAddress(address);
    }
};

/**
 * Checks if the given string is a checksummed address
 *
 * @method isChecksumAddress
 * @param {String} address the given HEX adress
 * @return {Boolean}
*/
var isChecksumAddress = function (address) {
    // Check each case
    address = address.replace('0x','');
    var addressHash = sha3(address.toLowerCase());
    for (var i = 0; i < 40; i++ ) {
        // the nth letter should be uppercase if the nth digit of casemap is 1
        if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 && address[i].toLowerCase() !== address[i])) {
            return false;
        }
    }
    return true;
};

function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

function unit_ts (ts, unit, digits = 10) {
	// set time to start time of timespan based on unit
	t = moment.utc(convert_ts(ts, 13));

	if (unit == "minute") {
		t.seconds(0);
	}
	if (unit == "hour") {
		t.minutes(0);
		t.seconds(0);
	}
	if (unit == "day") {
		t.hours(0);
		t.minutes(0);
		t.seconds(0);
	}
	if (unit == "month") {
		t.date(1);
		t.hours(0);
		t.minutes(0);
		t.seconds(0);
	}
	if (unit == "year") {
		t.month(0);
		t.date(1);
		t.hours(0);
		t.minutes(0);
		t.seconds(0);
	}

	return convert_ts(t.unix(), digits);				// 10 digit timestamp enough to cluster by unit
}

function last_unit_ts (unit, count, digits = 10) {
	// return ts with current timestamp - unit*count
	let t = moment.utc();

	// on purpose, the ts is not clipped down, to avoid including previous unit

	if (unit == "minute") {
		t.subtract(count, 'minute');
	}
	if (unit == "hour") {
		t.subtract(count, 'h');
	}
	if (unit == "day") {
		t.subtract(count, 'd');
	}
	if (unit == "month") {
		t.subtract(count, 'month');
	}
	if (unit == "year") {
		t.subtract(count, 'y');
	}

	return convert_ts(t.unix(), digits);
}

function convert_ts (ts, digits = 10) {
	let l = (ts+"").length;

	if (l == digits) return ts;
	if (l == 10 && digits == 13) return ts*1000;
	if (l == 13 && digits == 10) return Math.floor(ts/1000);
}

function unique_array (list) {
	return [...new Set(list)];
}

async function python_exe () {
	const win = 'C:\\Users\\siebeneicher\\AppData\\Local\\Programs\\Python\\Python37\\python.exe';
	const nix = "python3.6";

	// try ...
	return new Promise((resolve, reject) => {
		exec(nix + ' --version', async (err, out) => {
			//console.log(err, out);
			if (!err && out) {
				resolve(nix);
			} else {
				resolve(win);
			}
		});
	});
}

function calculate_future_block_number (syncedBlock, ts) {
	return syncedBlock.number + Math.ceil((convert_ts(ts,10) - convert_ts(syncedBlock.timestamp,10)) / config.cpc.block_each_second);
}

module.exports = {
	clone,
	convert_ts,
	unique_array,
	python_exe,
	last_unit_ts,
	unit_ts,
	calculate_future_block_number,
	isAddress,
	isChecksumAddress
}