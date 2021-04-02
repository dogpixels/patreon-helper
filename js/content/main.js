// trigger content script tab id registration on background side for further communication
browser.runtime.sendMessage({action: "setContentScriptTabId", data: {}});

// listen to Runtime Messages from background scripts
browser.runtime.onMessage.addListener((request, sender) => {
	console.info(`[Patreon Helper] Runtime Message received:`, request);

	switch (request.action) {
		case "clickLoadMore": clickLoadMore(request.data.url); break;
	}
});