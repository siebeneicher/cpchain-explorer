const { exec } = require('child_process');
const moment = require('moment');
const config = require('./config');

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

module.exports = {clone, convert_ts, unique_array, python_exe, last_unit_ts, unit_ts, calculate_future_block_number}