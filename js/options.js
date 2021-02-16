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
var contentCollectionEnabledCheckbox = document.getElementById("contentCollectionEnabledCheckbox");
var contentCollectionKnownCreators = document.getElementById("contentCollectionKnownCreators");
// var contentCollectionClearKnownCreatorsButton = document.getElementById("contentCollectionClearKnownCreators");

browser.runtime.getBackgroundPage().then((backgroundContext) => {
	downloadAttachmentsCheckbox.checked = backgroundContext.downloadAttachments;
	useLostAndFoundCheckbox.checked = backgroundContext.useLostAndFound;
	debugCheckbox.checked = backgroundContext.debug;
	downloadIntervalInput.value = backgroundContext.downloadInterval;
	contentCollectionEnabledCheckbox.checked = backgroundContext.contentCollectionEnabled;

	// open log accordion if debug is enabled
	if (debugCheckbox.checked)
		logCache.classList.add('open');

	// open known creators list accordion if content collection is enabled
	if (contentCollectionEnabledCheckbox.checked)
		contentCollectionKnownCreators.classList.add('open');

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

	downloadIntervalInput.addEventListener('change', (event) => {
		event.target.value = Math.max(event.target.value, 3000);
		event.target.value = Math.min(event.target.value, 2147483647); // signed 32 bit int

		backgroundContext.downloadInterval = event.target.value;
		backgroundContext.initializeDownloadInterval();
		backgroundContext.updateSettingsStorage();
	});

	contentCollectionEnabledCheckbox.addEventListener('change', (event) => {
		backgroundContext.contentCollectionEnabled = event.target.checked;
		backgroundContext.updateSettingsStorage();

		if (event.target.checked)
			contentCollectionKnownCreators.classList.add('open');
		else
			contentCollectionKnownCreators.classList.remove('open');
	});

	// update log window contents
	setInterval(() => {
		logCache.textContent = backgroundContext.log_content;
	}, 1000);

	// update known creators list
	setInterval(() => {
		contentCollectionKnownCreators.innerText = "";
		for (const name in backgroundContext.knownCreators) {
			let li = document.createElement('li');
			let label = document.createElement('label');
			let div = document.createElement('div');
			let input = document.createElement('input');
			let span = document.createElement('span');

			// label.innerHTML = `<input type="checkbox"${backgroundContext.knownCreators[name]? ' checked="checked"' : ''} /><span>${name}</span>`;
			input.type = 'checkbox';
			if (backgroundContext.knownCreators[name] === true) {
				input.checked = true;
			}

			span.innerText = name;
			
			label.addEventListener('change', (e) => {
				if (backgroundContext.knownCreators.hasOwnProperty(name)) {
					backgroundContext.knownCreators[name] = e.target.checked;
					backgroundContext.updateSettingsStorage();
				}
			});
			
			div.classList.add('delete-button');
			div.addEventListener('click', (e) => {
				if (backgroundContext.knownCreators.hasOwnProperty(name)) {
					delete backgroundContext.knownCreators[name];
					backgroundContext.updateSettingsStorage();
				}
				else {
					console.error(`User tried to delete creator "${name}", which was not part of knownCreators.`)
				}
			})
			
			label.appendChild(input);
			label.appendChild(span);
			li.appendChild(label);
			li.appendChild(div);
			contentCollectionKnownCreators.appendChild(li);
		}
	}, 1000);

}, (error) => {
	console.error("error loading background context:", error);
	document.getElementById("backgroundContextLoadFailedError").style.display = "block";
})