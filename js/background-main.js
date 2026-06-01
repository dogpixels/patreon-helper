/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

 /* global */
var dbVersion = 3;

/* options */
var downloadAttachments = true; // attachments currently only download with a "Save As" dialog; If false, these files will be ignored.
var useLostAndFound = true; // attachments with file_name = null will be downloaded with a random generated file name to {ArtistName}_{LostAndFoundSuffix}
// "greedy": collect from all creators by default, individual creators can be disabled
// "selective": only collect from creators explicitly enabled via the popup
var collectionMode = "greedy";
var knownCreators = {};
// "everything": download every file type. "selected": only download the groups enabled in mediaTypes.
var mediaTypeMode = "everything";
var mediaTypes = { image: true, video: true, audio: true, document: true, font: true, archive: true };
// "flat": store files directly under <creator>/. "byType": sort into <creator>/images, <creator>/videos, ...
var storageMode = "flat";

browser.storage.local.get('settings').then((result) => {
	if (result.hasOwnProperty('settings')) {
		if (result.settings.hasOwnProperty('downloadAttachments'))
			downloadAttachments = result.settings.downloadAttachments;
		
		if (result.settings.hasOwnProperty('useLostAndFound'))
			useLostAndFound = result.settings.useLostAndFound;
	
		if (result.settings.hasOwnProperty('debug'))
			debug = result.settings.debug;
	
		if (result.settings.hasOwnProperty('collectionMode'))
			collectionMode = result.settings.collectionMode;
		else if (result.settings.hasOwnProperty('contentCollectionEnabled'))
			// migrate legacy boolean setting saved before collectionMode was introduced
			collectionMode = result.settings.contentCollectionEnabled ? "greedy" : "selective";

		if (result.settings.hasOwnProperty('knownCreators'))
			knownCreators = result.settings.knownCreators;

		if (result.settings.hasOwnProperty('mediaTypeMode'))
			mediaTypeMode = result.settings.mediaTypeMode;

		// merge so groups added in future versions still default to enabled
		if (result.settings.hasOwnProperty('mediaTypes'))
			mediaTypes = Object.assign(mediaTypes, result.settings.mediaTypes);

		if (result.settings.hasOwnProperty('storageMode'))
			storageMode = result.settings.storageMode;

		if (result.settings.hasOwnProperty('concurrentDownloads'))
			concurrentDownloads = result.settings.concurrentDownloads;
	}

	console.info("loaded user settings from localStorage:", result);

	updateSettingsStorage();
});

function updateSettingsStorage() {
	let settings = {
		downloadAttachments: downloadAttachments,
		useLostAndFound: useLostAndFound,
		debug: debug,
		collectionMode: collectionMode,
		knownCreators: knownCreators,
		mediaTypeMode: mediaTypeMode,
		mediaTypes: mediaTypes,
		storageMode: storageMode,
		concurrentDownloads: concurrentDownloads
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
var mediaTypeGroups = {
	image:    ['png', 'gif', 'jpg', 'jpeg', 'bmp', 'ai', 'ps', 'svg', 'tif', 'tiff', 'ico'],
	video:    ['mp4', 'webm', 'avi', 'mpg', 'mpeg', 'swf', 'flv', '3gp', '3g2', 'h264', 'mkv', 'mov', 'm4v', 'wmv'],
	audio:    ['mp3', 'ogg', 'wav', 'wma', 'mpa', 'mid', 'midi', 'cda', 'aif'],
	document: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'epub'],
	font:     ['ttf', 'otf', 'fon', 'fnt'],
	archive:  ['zip', '7z', 'rar', 'tar.gz', 'z']
};
// flattened for plain "does this link point at a media file" checks (post content link extraction)
var mediaExtensions = Object.values(mediaTypeGroups).flat();

// strips any leading directory path from a file name, keeping only the final component.
// patreon sometimes ships file names that contain a leading path, which would otherwise
// create unwanted subfolders under the creator directory.
function baseName(name) {
	if (!name) return name;
	return name.split(/[\\/]/).pop();
}

// pulls the file extension from a file name or url (ignores #fragment and ?query), lowercased
function fileExtensionOf(s) {
	if (!s) return null;
	let base = s.split('#')[0].split('?')[0];
	let match = base.match(/\.([a-z0-9]+)$/i);
	return match ? match[1].toLowerCase() : null;
}

// classifies a download by its file extension into one of the mediaTypeGroups, or 'unknown'
function getMediaType(filename, url) {
	let ext = fileExtensionOf(filename) || fileExtensionOf(url);
	if (!ext)
		return 'unknown';
	for (let group in mediaTypeGroups)
		if (mediaTypeGroups[group].includes(ext))
			return group;
	return 'unknown';
}

// applies the user's "Download File Types" setting. unknown types are always allowed (fail-open),
// so the filter only ever removes clearly-categorized groups the user explicitly disabled.
function isMediaTypeEnabled(filename, url) {
	if (mediaTypeMode !== "selected")
		return true;
	let type = getMediaType(filename, url);
	if (type === 'unknown')
		return true;
	return mediaTypes[type] === true;
}

// subfolder names used when storageMode is "byType"; unrecognized types land in "other"
var mediaTypeFolders = {
	image: 'images', video: 'videos', audio: 'audio',
	document: 'documents', font: 'fonts', archive: 'archives', unknown: 'other'
};

// builds the full relative download path for a file. in "byType" mode a media-type
// subfolder is inserted between the creator folder and the file (<creator>/images/foo.png).
// fileName is expected to already be a bare file name (see baseName).
function buildDownloadPath(creator, fileName, url) {
	let path = downloadPrefix + creator + "/";
	if (storageMode === "byType")
		path += (mediaTypeFolders[getMediaType(fileName, url)] || 'other') + "/";
	return path + fileName;
}
var unknownCreator = "_unknown";
var LostAndFoundSuffix = "_LostAndFound"

console.info("patreon helper 1.15 loaded");

var pageCreator = null;
browser.runtime.onMessage.addListener((request, sender) => {
	console.info(`Runtime Message received. Action: "${request.action}" from ${sender.tab.active? "active ": ""}tab with url "${sender.tab.url}"`, request);

	switch (request.action) {
		case "setPageCreator": pageCreator = request.data.creator; console.info(`pageCreator set to "${pageCreator}".`); break;
	}
});