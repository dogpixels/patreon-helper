const postsUrlRegex = /patreon\.com\/(\w+)\/posts\?(.*)/;

let match = postsUrlRegex.exec(window.location.href);

browser.runtime.sendMessage({
	action: "setPostsPageDetails",
	data: {
		creator: match !== null ? match[1] : null,
		arguments: match !== null ? match[2] : null
	}
});