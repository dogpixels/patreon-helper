const postsUrlRegex = /patreon\.com\/(\w+)\/posts/;

let match;

browser.runtime.sendMessage({
	action: "setPageCreator",
	data: {
		creator: (match = postsUrlRegex.exec(window.location.href)) !== null ? match[1] : null
	}
});	
