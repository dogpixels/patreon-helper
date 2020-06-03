class ExportLog {
	// constructor(enabled = false) {
	// 	_enabled = enabled;

		// let db_context = indexedDB.open("ExportLog", ExportLog.db_version);

		// db_context.onupgradeneeded = () => {
		// 	let store = db_context.result.createObjectStore("log", {keyPath: "id", autoIncrement: true});
		// 	store.createIndex("line", "line", {unique: false});
		// }

		// db_context.onsuccess = () => {
		// 	console.info(`ExportLog initialized at ${new Date().toLocaleString("en-US", {hour12: false})}`);
		// 	ExportLog._db = db_context.result;
		// }

		// db_context.onerror = event => {
		// 	ExportLog._enabled = false;
		// 	console.error('failed to initialize ExportLog', event);
		// }
	// }

	static log(msg, obj)   {ExportLog._insert(`[log  ] ${msg}`); if (obj) ExportLog._insert(JSON.stringify(obj, null, 1))}
	static info(msg, obj)  {ExportLog._insert(`[info ] ${msg}`); if (obj) ExportLog._insert(JSON.stringify(obj, null, 1))}
	static error(msg, obj) {ExportLog._insert(`[error] ${msg}`); if (obj) ExportLog._insert(JSON.stringify(obj, null, 1))}
	static warn(msg, obj)  {ExportLog._insert(`[warn ] ${msg}`); if (obj) ExportLog._insert(JSON.stringify(obj, null, 1))}
	
	static _insert(line) {
		if (!ExportLog.enabled)
			return;
			
		ExportLog.content += `\r\n${new Date().toLocaleString("en-US", {hour12: false})} ${line}`;

		// if (typeof ExportLog._db === 'undefined') {
		// 	console.warn("ExportLog not (yet) initialized, line will be discarded: ", line);
		// 	return;
		// }

		// let op = ExportLog._db.transaction("log", "readwrite").objectStore("log").add({
		// 	line: line
		// });

		// op.onerror = () => {
		// 	console.warn("error adding entry to database", filename);
		// };
	}

	// getExportContent() {
	// 	ExportLog.info(`ExportLog download started at ${new Date().toLocaleString("en-US", {hour12: false})}`);

	// 	let content = 'data:text/json;charset=utf-8,';

	// 	let request = ExportLog._db.transaction("log", "readwrite").objectStore("log").getAll();
	// 	request.onsuccess = () => {
	// 		request.result.forEach(row => {
	// 			content += `\n${row.line}`;
	// 		});

	// 		console.info("before return content", content);
	// 		return content;
	// 	}

	// 	return null;
	// }
}

ExportLog.content = `\r\n`;
ExportLog.enabled = false;
