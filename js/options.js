/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var downloadAttachmentsCheckbox = document.getElementById("downloadAttachments");
var useLostAndFoundCheckbox = document.getElementById("useLostAndFound");
var debugCheckbox = document.getElementById("debug");
var logCache = document.getElementById("logCache");
var logCopyButton = document.getElementById("logCopy");
var downloadIntervalInput = document.getElementById("downloadInterval");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;
	useLostAndFoundCheckbox.checked = backgroundContext.useLostAndFound;
	debugCheckbox.checked = backgroundContext.debug;
	downloadIntervalInput.value = backgroundContext.downloadInterval;

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

	setInterval(() => {
		logCache.textContent = backgroundContext.getExportLog();
	}, 1000);

	downloadIntervalInput.addEventListener('change', (event) => {
		event.target.value = Math.max(event.target.value, 3000);
		event.target.value = Math.min(event.target.value, 2147483647); // signed 32 bit int

		backgroundContext.downloadInterval = event.target.value;
		backgroundContext.initializeDownloadInterval();
		backgroundContext.updateSettingsStorage();
	});

}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})