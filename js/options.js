/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var downloadAttachmentsCheckbox = document.getElementById("downloadAttachments");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;

	downloadAttachmentsCheckbox.addEventListener('change', (event) => {
		backgroundContext.downloadAttachments = event.target.checked;
		backgroundContext.updateSettingsStorage();
	});
}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})