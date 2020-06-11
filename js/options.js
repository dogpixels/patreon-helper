/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var useLostAndFoundCheckbox = document.getElementById("useLostAndFound");
var debugCheckbox = document.getElementById("debug");
var logCache = document.getElementById("logCache");
var logCopyButton = document.getElementById("logCopy");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	useLostAndFoundCheckbox.checked = backgroundContext.useLostAndFound;
	debugCheckbox.checked = backgroundContext.debug;

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
	})

	setInterval(() => {
		logCache.textContent = backgroundContext.getExportLog();
	}, 1000);

}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})