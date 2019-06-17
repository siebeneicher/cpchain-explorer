function clone (obj) {
	return JSON.parse(JSON.stringify(obj));
}

function convert_ts (ts, digits = 10) {
	let l = (ts+"").length;

	if (l == digits) return ts;
	if (l == 10 && digits == 13) return ts*1000;
	if (l == 13 && digits == 10) return Math.floor(ts/1000);
}

module.exports = {clone, convert_ts}