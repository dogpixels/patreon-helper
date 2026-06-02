browser.runtime.getBackgroundPage().then(bg => {
	const currentCreatorEl = document.getElementById('currentCreator');
	const pendingCountEl = document.getElementById('pendingCount');
	const failedCountEl = document.getElementById('failedCount');
	const clearFailedButton = document.getElementById('clearFailedButton');
	const toggleCreatorBtn = document.getElementById('toggleCreatorButton');
	const concurrentDownloadsInput = document.getElementById('concurrentDownloadsInput');
	const openSettingsPageEl = document.getElementById('openSettingsPageLink');
	const creatorRow = document.getElementById('creatorRow');
	const homeFeedInfoEl = document.getElementById('homeFeedInfo');
	const feedModeEl = document.getElementById('feedMode');
	const feedHintEl = document.getElementById('feedHint');
	let activeTabUrl = null;

	function updateCreator() {
		let creator = bg.pageCreator;
		// the home feed (patreon.com/home) has no single creator — it mixes posts from
		// every creator you follow, so we show feed-level info instead of a creator toggle.
		let isHomeFeed = activeTabUrl && /patreon\.com\/home\b/.test(activeTabUrl);

		if (creator) {
			creatorRow.style.display = '';
			toggleCreatorBtn.style.display = '';
			homeFeedInfoEl.style.display = 'none';

			currentCreatorEl.textContent = creator;
			currentCreatorEl.classList.remove('unknown');

			let enabled = bg.knownCreators[creator] === true;
			toggleCreatorBtn.disabled = false;
			toggleCreatorBtn.textContent = enabled ? `Disable "${creator}"` : `Enable "${creator}"`;
			toggleCreatorBtn.classList.toggle('secondary', enabled);
		} else if (isHomeFeed) {
			creatorRow.style.display = 'none';
			toggleCreatorBtn.style.display = 'none';
			homeFeedInfoEl.style.display = '';

			let selective = bg.collectionMode === 'selective';
			feedModeEl.textContent = selective ? 'Selective' : 'Greedy';
			feedHintEl.style.display = selective ? '' : 'none';
		} else {
			creatorRow.style.display = '';
			toggleCreatorBtn.style.display = '';
			homeFeedInfoEl.style.display = 'none';

			currentCreatorEl.textContent = 'not detected';
			currentCreatorEl.classList.add('unknown');
			toggleCreatorBtn.disabled = true;
			toggleCreatorBtn.textContent = 'No creator detected';
			toggleCreatorBtn.classList.remove('secondary');
		}
	}

	function updateStats() {
		let tx = bg.db.transaction("downloads");
		let index = tx.objectStore("downloads").index("state");
		index.count(IDBKeyRange.only(0)).onsuccess = e => {
			pendingCountEl.textContent = e.target.result;
		};
		index.count(IDBKeyRange.only(3)).onsuccess = e => {
			failedCountEl.textContent = e.target.result;
			clearFailedButton.disabled = e.target.result === 0;
		};
	}

	// state 3 is self-healing — intercept.js resets it automatically when Patreon serves a fresh url on the next visit;
	// Clear removes entries manually so they can be re-collected from scratch
	clearFailedButton.addEventListener('click', () => {
		let store = bg.db.transaction("downloads", "readwrite").objectStore("downloads");
		store.index("state").openCursor(IDBKeyRange.only(3)).onsuccess = e => {
			let cursor = e.target.result;
			if (!cursor) { updateStats(); return; }
			cursor.delete();
			cursor.continue();
		};
	});

	concurrentDownloadsInput.value = bg.concurrentDownloads;
	concurrentDownloadsInput.addEventListener('change', e => {
		let val = Math.min(Math.max(parseInt(e.target.value) || 1, 1), 4);
		e.target.value = val;
		bg.concurrentDownloads = val;
		bg.updateSettingsStorage();
	});

	toggleCreatorBtn.addEventListener('click', () => {
		let creator = bg.pageCreator;
		if (!creator) return;
		let enabled = bg.knownCreators[creator] === true;
		bg.setCreatorContentCollection(creator, !enabled);
		updateCreator();

		// reloading the tab re-triggers API requests so newly enabled creators are collected immediately
		if (enabled) return; // disabling needs no reload
		browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
			if (tabs[0]) browser.tabs.reload(tabs[0].id);
		});
	});

	openSettingsPageEl.addEventListener('click', () => {
		browser.runtime.openOptionsPage();
		window.close(); // close popup
	});

	browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
		if (!tabs[0]) { updateCreator(); updateStats(); return; }

		activeTabUrl = tabs[0].url;

		// disable interactive controls and show a notice when not on the target site
		let isPatreonTab = tabs[0].url && tabs[0].url.includes('patreon.com');
		if (!isPatreonTab) {
			document.body.classList.add('not-patreon');
			return;
		}

		browser.tabs.sendMessage(tabs[0].id, {action: "getCreator"})
			.then(response => {
				if (response && response.creator) bg.pageCreator = response.creator;
			})
			.catch(() => {})
			.finally(() => { updateCreator(); updateStats(); });
	});

	setInterval(() => { updateCreator(); updateStats(); }, 2000);
});
