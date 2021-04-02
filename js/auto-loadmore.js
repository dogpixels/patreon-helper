const postsUrlArgumentsRegex = /filters\[month\]\=(\d{4})\-(\d{1,2})/;
const loadMoreUrlCursorRegex = /\%5Bcursor\%5D\=([\w-]+)/;
var lastLoadMoreCursor = "";

function triggerLoadMore(url) {
	let match = loadMoreUrlCursorRegex.exec(url);

	if (match === null) {
		console.error(`Failed to extract cursor from LoadMore url:`, url);
		return;
	}

	let cursor = match[1];

	if (cursor !== lastLoadMoreCursor) {
		lastLoadMoreCursor = cursor;
	}
	else {
		console.warn(`Cursor "${cursor}" seen before - possible LoadMore loop bug encountered. Aborting!`);
		return;
	}

	if (contentScriptTabId === -1) {
		console.error(`Attempted to trigger clickLoadMore() on content script, but content script TabId has not been set yet.`);
		return;
	}

	browser.tabs.sendMessage(contentScriptTabId, {
		action: "clickLoadMore",
		data: {
			url: url,
			cursor: cursor
		}
	});

	console.info(`Issued clickLoadMore action command to TabId "${contentScriptTabId}" with cursor "${cursor}" and url "${url}".`);
}

function autoloadmore_process(response) {
	let _debug_skipPostsPageArgumentsCheck = false;
	let year = null;
	let month = null;

	// check if user is browsing patreon.com/{creator}/posts
	if (pageCreator === null || pageArguments === null) {
		return;
	}

	let match = postsUrlArgumentsRegex.exec(pageArguments);

	// make sure user is browsing the per-month posts page; if we'd only check for the posts page, that'd mean an irresponsibly large amount of content to "load more"
	if (match === null) {
		return;
	}

	if (match.length >= 3 || (match.length === 2 && _debug_skipPostsPageArgumentsCheck)) {
		year = match[1];
		month = match.length > 2? match[2] : "1";

		console.info(`Monthly posts page detected. Creator: "${pageCreator}", Year: "${year}", Month: "${month}".`);
	}
	else {
		return;
	}

	// search response for "load more" link and trigger it
	if (response.hasOwnProperty("links")) {
		if (response.links.hasOwnProperty("next")) {
			setTimeout(() => {
				triggerLoadMore(response.links.next);
			}, loadMoreDelay);
		}
	}
}