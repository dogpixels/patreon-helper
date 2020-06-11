/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

 /* global */
var debug = false;
var dbVersion = 1;
var foregroundTabId = -1;

/* options */
var useLostAndFound = true; // attachments with file_name = null will be downloaded with a random generated file name to {ArtistName}_{LostAndFoundSuffix}

browser.storage.local.get('settings').then((result) => {
	if (result.hasOwnProperty('settings') && result.hasOwnProperty('useLostAndFound'))
		useLostAndFound = result.useLostAndFound;
	else
		updateSettingsStorage();

	if (result.hasOwnProperty('settings') && result.hasOwnProperty('debug'))
		debug = result.debug;
	else
		updateSettingsStorage();
});

function updateSettingsStorage() {
	let settings = {
		useLostAndFound: useLostAndFound,
		debug: debug
	}

	ExportLog.enabled = settings.debug;

	ExportLog.info('user settings changed:', settings);

	browser.storage.local.set({settings})
		.then(
			() => {if (debug) console.info('wrote settings to local storage:', settings)}, 
			(error) => {console.error('failed to write settings to local storage, details:', error)}
		);
}

function getExportLog() {
	return ExportLog.content;
}

 /* download */
var concurrentDownloads = 1;
var downloadInterval = 6000; // ms
var downloadPrefix = 'patreon/';
var mediaExtensions = [
	'png', 'gif', 'jpg', 'jpeg', 'bmp', 'ai', 'ps', 'svg', 'tif', 'tiff', 'ico', 							// image
	'mp4', 'webm', 'avi', 'mpg', 'mpeg', 'swf', 'flv', '3gp', '3g2', 'h264', 'mkv', 'mov', 'm4v', 'wmv', 	// video 
	'ttf', 'otf', 'fon', 'fnt', 																			// font
	'mp3', 'ogg', 'wav', 'wma', 'mpa', 'mid', 'midi', 'cda', 'aif', 										// sound
	'zip', '7z', 'rar', 'tar.gz', 'z' 																		// compressed files
];
var unknownCreator = "_unknown";
var LostAndFoundSuffix = "_LostAndFound"

console.info("patreon helper 1.8 loaded");