/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

 /* global */
var debug = false;
var dbVersion = 1;

/* options */
var downloadAttachments = false; // attachments currently only download with a "Save As" dialog; If false, these files will be ignored.

browser.storage.local.get('settings').then((result) => {
	if (result.hasOwnProperty('settings') && result.hasOwnProperty('downloadAttachments'))
		downloadAttachments = result.downloadAttachments;
	else 
		updateSettingsStorage();

	if (result.hasOwnProperty('settings') && result.hasOwnProperty('debug'))
		debug = result.debug;
	else
		updateSettingsStorage();
});

function updateSettingsStorage() {
	let settings = {
		downloadAttachments: downloadAttachments,
		debug: debug
	}

	browser.storage.local.set({settings})
		.then(
			() => {if (debug) console.info('wrote settings to local storage:', settings)}, 
			(error) => {console.error('failed to write settings to local storage, details:', error)}
		);
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


// console.info("patreon helper 1.6 loaded; debug: ", debug);