var debug = false;
log_content = content = `\r\n`;

// copy original console functions to another place
console._originalConsoleFunctions = [];
console._originalConsoleFunctions[0] = console.log;
console._originalConsoleFunctions[1] = console.info;
console._originalConsoleFunctions[2] = console.warn;
console._originalConsoleFunctions[3] = console.error;

// replace console functions with own
console.log = (p1, p2 = null) => {_handleLog(0, p1, p2)}
console.info = (p1, p2 = null) => {_handleLog(1, p1, p2)}
console.warn = (p1, p2 = null) => {_handleLog(2, p1, p2)}
console.error = (p1, p2 = null) => {_handleLog(3, p1, p2)}

// handle console functions
function _handleLog(lvl, p1, p2) {
	// do nothing if debug is disabled
	if (!debug)
		return;

	// find call origin (formatting should result in "file:line")
	const s = new Error().stack.toString().split(/\r\n|\n/)[2];
	const src = `[${s.substr(s.lastIndexOf('/') + 1).replace(/\:\d+$/, "")}]`;

	// create timestamp for log
	const time = new Date().toLocaleString("en-US", {hour12: false});

	// express lvl as string
	let lvls = "[log  ]";
	switch (lvl) {
		case 1: lvls = "[info ]"; break;
		case 2: lvls = "[warn ]"; break;
		case 3: lvls = "[error]"; break;
 	}

	// handle single param call
	if (p2 === null) {
		// call original console function with altered input
		console._originalConsoleFunctions[lvl].apply(console, [`${time} ${lvls} ${src} ${p1}`]);

		// add to log file
		log_content += `\r\n${time} ${lvls} ${src} ${p1}`;
	}

	// handle two param call
	else {
		// call original console function with altered input
		console._originalConsoleFunctions[lvl].apply(console, [`${time} ${lvls} ${src} ${p1}`, p2]);

		// add to log file
		log_content += `\r\n${time} ${lvls} ${src} ${p1}\r\n${JSON.stringify(p2, null, 1)}`;
	}
}