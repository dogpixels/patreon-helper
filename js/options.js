/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var downloadAttachmentsCheckbox = document.getElementById("downloadAttachments");
var useLostAndFoundCheckbox = document.getElementById("useLostAndFound")

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;
	useLostAndFoundCheckbox.checked = backgroundContext.useLostAndFound;

	downloadAttachmentsCheckbox.addEventListener('change', (event) => {
		backgroundContext.downloadAttachments = event.target.checked;
		backgroundContext.updateSettingsStorage();
	});

	useLostAndFoundCheckbox.addEventListener('change', (event) => {
		backgroundContext.useLostAndFound = event.target.checked;
		backgroundContext.updateSettingsStorage();
	})
}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})