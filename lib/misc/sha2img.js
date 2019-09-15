function sha2img(hash) {
	const size = parseInt(Math.ceil(Math.sqrt(hash.length/6)));

	var r = new RegExp(`[a-z0-9]{${size*6}}`, "ig");
	let matches = hash.match(r);

	let leftover = hash.slice(matches.join('').length);

	if(leftover.length > 0) {
		let paddingLength = matches[0].length - leftover.length + 1;
		let padding = (new Array(paddingLength)).join("0");
		matches.push(leftover + padding);
	}

	while(matches.length < size) {
		matches.push((new Array(size * 6 + 1)).join("0"));
	}

	matches = matches.map(m => {
		return m.match(/[a-f0-9]{6}/ig)
					.map(c => {
						return c.match(/[a-f0-9]{2}/ig)
									.map(p => parseInt(`0x${p}`, 'hex'))
					});
	});

	return matches;
}

module.exports = sha2img;