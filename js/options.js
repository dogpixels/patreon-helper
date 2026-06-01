/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var downloadAttachmentsCheckbox = document.getElementById("downloadAttachments");
var useLostAndFoundCheckbox = document.getElementById("useLostAndFound");
var debugCheckbox = document.getElementById("debug");
var logCache = document.getElementById("logCache");
var logCopyButton = document.getElementById("logCopy");
var collectionModeGreedy = document.getElementById("collectionModeGreedy");
var collectionModeSelective = document.getElementById("collectionModeSelective");
var contentCollectionKnownCreators = document.getElementById("contentCollectionKnownCreators");
var resetCreatorSelect = document.getElementById("resetCreatorSelect");
var resetDownloadHistoryButton = document.getElementById("resetDownloadHistoryButton");
var resetFeedback = document.getElementById("resetFeedback");
var clearAllButton = document.getElementById("clearAllButton");
var mediaTypeModeEverything = document.getElementById("mediaTypeModeEverything");
var mediaTypeModeSelected = document.getElementById("mediaTypeModeSelected");
var mediaTypeGroupList = document.getElementById("mediaTypeGroupList");
var mediaTypeCheckboxes = {
	image: document.getElementById("mediaTypeImage"),
	video: document.getElementById("mediaTypeVideo"),
	audio: document.getElementById("mediaTypeAudio"),
	document: document.getElementById("mediaTypeDocument"),
	font: document.getElementById("mediaTypeFont"),
	archive: document.getElementById("mediaTypeArchive")
};
var storageModeFlat = document.getElementById("storageModeFlat");
var storageModeByType = document.getElementById("storageModeByType");
// var contentCollectionClearKnownCreatorsButton = document.getElementById("contentCollectionClearKnownCreators");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;
	useLostAndFoundCheckbox.checked = backgroundContext.useLostAndFound;
	debugCheckbox.checked = backgroundContext.debug;
	(backgroundContext.collectionMode === "selective" ? collectionModeSelective : collectionModeGreedy).checked = true;
	contentCollectionKnownCreators.classList.add('open');

	// media type filter
	(backgroundContext.mediaTypeMode === "selected" ? mediaTypeModeSelected : mediaTypeModeEverything).checked = true;
	for (let group in mediaTypeCheckboxes)
		mediaTypeCheckboxes[group].checked = backgroundContext.mediaTypes[group] !== false;
	updateMediaTypeGroupListState();

	// the group checkboxes only matter in "selected" mode; grey them out otherwise
	function updateMediaTypeGroupListState() {
		let enabled = mediaTypeModeSelected.checked;
		for (let group in mediaTypeCheckboxes)
			mediaTypeCheckboxes[group].disabled = !enabled;
		mediaTypeGroupList.style.opacity = enabled ? "1" : "0.5";
	}

	[mediaTypeModeEverything, mediaTypeModeSelected].forEach(radio => {
		radio.addEventListener('change', (event) => {
			backgroundContext.mediaTypeMode = event.target.value;
			backgroundContext.updateSettingsStorage();
			updateMediaTypeGroupListState();
		});
	});

	for (let group in mediaTypeCheckboxes) {
		mediaTypeCheckboxes[group].addEventListener('change', (event) => {
			backgroundContext.mediaTypes[group] = event.target.checked;
			backgroundContext.updateSettingsStorage();
		});
	}

	// folder structure
	(backgroundContext.storageMode === "byType" ? storageModeByType : storageModeFlat).checked = true;

	[storageModeFlat, storageModeByType].forEach(radio => {
		radio.addEventListener('change', (event) => {
			backgroundContext.storageMode = event.target.value;
			backgroundContext.updateSettingsStorage();
		});
	});

	// open log accordion if debug is enabled
	if (debugCheckbox.checked)
		logCache.classList.add('open');

	downloadAttachmentsCheckbox.addEventListener('change', (event) => {
		backgroundContext.downloadAttachments = event.target.checked;
		backgroundContext.updateSettingsStorage();
	});

	useLostAndFoundCheckbox.addEventListener('change', (event) => {
		backgroundContext.useLostAndFound = event.target.checked;
		backgroundContext.updateSettingsStorage();
	});

	debugCheckbox.addEventListener('change', (event) => {
		backgroundContext.debug = event.target.checked;
		backgroundContext.updateSettingsStorage();

		if (event.target.checked)
			logCache.classList.add('open');
		else
			logCache.classList.remove('open');
	});

	logCopyButton.addEventListener('click', (event) => {
		navigator.clipboard.writeText(logCache.value);
	});


	[collectionModeGreedy, collectionModeSelective].forEach(radio => {
		radio.addEventListener('change', (event) => {
			backgroundContext.collectionMode = event.target.value;
			backgroundContext.updateSettingsStorage();
		});
	});

	// update log window contents
	setInterval(() => {
		logCache.textContent = backgroundContext.log_content;
	}, 1000);

	resetDownloadHistoryButton.addEventListener('click', () => {
		let creator = resetCreatorSelect.value;
		let db = backgroundContext.db;
		let store = db.transaction("downloads", "readwrite").objectStore("downloads");
		let count = 0;

		let cursorRequest = creator === "__all__"
			? store.openCursor()
			: store.index("filename").openCursor(IDBKeyRange.bound(`patreon/${creator}/`, `patreon/${creator}/￿`));

		cursorRequest.onsuccess = (event) => {
			let cursor = event.target.result;
			if (!cursor) {
				let label = creator === "__all__" ? "all creators" : `"${creator}"`;
				resetFeedback.textContent = `Cleared ${count} file(s) from history for ${label}. They will be re-downloaded with a fresh URL the next time you browse them.`;
				resetFeedback.style.display = "block";
				setTimeout(() => { resetFeedback.style.display = "none"; }, 4000);
				return;
			}
			// drop only finished (1) and failed (3) records; leave pending (0) and in-progress (2)
			// so the active download queue isn't disturbed. removing the record (rather than resetting
			// its state) means the stale, expired url is gone too — the next browse re-adds the file
			// fresh via the !record branch in intercept.js, so no doomed download with a dead token.
			if (cursor.value.state === 1 || cursor.value.state === 3) {
				cursor.delete();
				count++;
			}
			cursor.continue();
		};
	});

	// update known creators list
	setInterval(() => {
		contentCollectionKnownCreators.innerText = "";

		// sync reset dropdown with known creators
		let currentSelection = resetCreatorSelect.value;
		while (resetCreatorSelect.options.length > 1) resetCreatorSelect.remove(1);
		for (const name in backgroundContext.knownCreators) {
			let opt = document.createElement('option');
			opt.value = name;
			opt.textContent = name;
			if (name === currentSelection) opt.selected = true;
			resetCreatorSelect.appendChild(opt);
		}

		let isSelective = backgroundContext.collectionMode === "selective";

		for (const name in backgroundContext.knownCreators) {
			let enabled = backgroundContext.knownCreators[name] === true;


			let li = document.createElement('li');
			let label = document.createElement('label');
			let div = document.createElement('div');
			let input = document.createElement('input');
			let span = document.createElement('span');

			input.type = 'checkbox';
			input.checked = enabled;

			span.innerText = name;

			label.addEventListener('change', (e) => {
				if (backgroundContext.knownCreators.hasOwnProperty(name)) {
					backgroundContext.knownCreators[name] = e.target.checked;
					backgroundContext.updateSettingsStorage();
				}
			});

			div.classList.add('delete-button');
			div.addEventListener('click', () => {
				if (backgroundContext.knownCreators.hasOwnProperty(name)) {
					delete backgroundContext.knownCreators[name];
					backgroundContext.updateSettingsStorage();
				} else {
					console.error(`User tried to delete creator "${name}", which was not part of knownCreators.`);
				}
			});

			label.appendChild(input);
			label.appendChild(span);
			li.appendChild(label);
			li.appendChild(div);
			contentCollectionKnownCreators.appendChild(li);
		}
	}, 1000);

	clearAllButton.addEventListener('click', () => {
		if (!window.confirm('This will delete the entire download history, all known creators, and reset all settings to default. Continue?'))
			return;

		backgroundContext.db.transaction("downloads", "readwrite").objectStore("downloads").clear();

		backgroundContext.knownCreators = {};
		backgroundContext.downloadAttachments = true;
		backgroundContext.useLostAndFound = true;
		backgroundContext.collectionMode = "greedy";
		backgroundContext.mediaTypeMode = "everything";
		backgroundContext.mediaTypes = { image: true, video: true, audio: true, document: true, font: true, archive: true };
		backgroundContext.storageMode = "flat";
		backgroundContext.concurrentDownloads = 1;
		backgroundContext.activeDownloads = 0;

		browser.storage.local.clear().then(() => {
			browser.runtime.reload();
		});
	});

}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})