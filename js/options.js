/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var downloadAttachmentsCheckbox = document.getElementById("downloadAttachments");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	console.info("loaded bgcontext", backgroundContext);

	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;

	downloadAttachmentsCheckbox.addEventListener('change', (event) => {
		backgroundContext.downloadAttachments = event.target.checked;
	});
}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})