/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

 /* global */
var dbVersion = 3;

/* options */
var downloadAttachments = true; // attachments currently only download with a "Save As" dialog; If false, these files will be ignored.
var useLostAndFound = true; // attachments with file_name = null will be downloaded with a random generated file name to {ArtistName}_{LostAndFoundSuffix}
var downloadInterval = 3000; // ms
var downloadIntervalId = 0;
var contentCollectionEnabled = true;
var knownCreators = {};

browser.storage.local.get('settings').then((result) => {
	if (result.hasOwnProperty('settings')) {
		if (result.settings.hasOwnProperty('downloadAttachments'))
			downloadAttachments = result.settings.downloadAttachments;
		
		if (result.settings.hasOwnProperty('useLostAndFound'))
			useLostAndFound = result.settings.useLostAndFound;
	
		if (result.settings.hasOwnProperty('debug'))
			debug = result.settings.debug;
	
		if (result.settings.hasOwnProperty('downloadInterval'))
			downloadInterval = result.settings.downloadInterval;

		if (result.settings.hasOwnProperty('contentCollectionEnabled'))
			contentCollectionEnabled = result.settings.contentCollectionEnabled;

		if (result.settings.hasOwnProperty('knownCreators'))
			knownCreators = result.settings.knownCreators;
	}

	console.info("loaded user settings from localStorage:", result);

	updateSettingsStorage();

	initializeDownloadInterval();
});

function updateSettingsStorage() {
	let settings = {
		downloadAttachments: downloadAttachments,
		useLostAndFound: useLostAndFound,
		debug: debug,
		downloadInterval: downloadInterval,
		contentCollectionEnabled: contentCollectionEnabled,
		knownCreators: knownCreators
	}

	console.info('user settings changed:', settings);

	browser.storage.local.set({settings})
	.then(
		() => {
			// console.info('wrote settings to localStorage:', settings);
		}, 
		(error) => {
			console.error('failed to write settings to localStorage, details:', error);
		}
	);
}

 /* download */
var concurrentDownloads = 1;
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

console.info("patreon helper 1.14 loaded");