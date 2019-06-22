const { exec } = require('child_process');
const moment = require('moment');

function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

function last_unit_ts (unit, count) {
	let t = moment();

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

	return convert_ts(t.unix(), 10);
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

module.exports = {clone, convert_ts, unique_array, python_exe, last_unit_ts}