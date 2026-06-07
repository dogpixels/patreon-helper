// matches patreon.com/cw/{creator} and patreon.com/c/{creator}
const creatorUrlRegex = /patreon\.com\/(?:cw|c)\/(\w+)/;

function detectAndSendCreator() {
	let match = creatorUrlRegex.exec(window.location.href);
	let creator = match !== null ? match[1] : null;
	browser.runtime.sendMessage({
		action: "setPageCreator",
		data: { creator }
	});
}

// On a directly-opened single post, Patreon ships the post data embedded as Next.js SSR
// state in a <script id="__NEXT_DATA__"> tag rather than via an XHR the background webRequest
// interceptor could catch. We pull that JSON:API envelope out and hand it to the background,
// which runs it through the very same extraction (extractDownloadInfo) as the intercepted
// feed responses — no duplicated logic. We feature-detect the embedded post instead of
// gating on the url path, so this keeps working even if Patreon renames the /posts/ route.
// Only the initial server-rendered post is covered; posts reached via in-page SPA navigation
// aren't (re)embedded here, so this runs once at load, not on SPA navigation.
function detectAndSendPost() {
	let el = document.getElementById("__NEXT_DATA__");
	if (!el) return;

	let nextData;
	try {
		nextData = JSON.parse(el.textContent);
	} catch (e) {
		console.error("patreon-helper: failed to parse __NEXT_DATA__", e);
		return;
	}

	let post = nextData
		&& nextData.props
		&& nextData.props.pageProps
		&& nextData.props.pageProps.bootstrapEnvelope
		&& nextData.props.pageProps.bootstrapEnvelope.pageBootstrap
		&& nextData.props.pageProps.bootstrapEnvelope.pageBootstrap.post;

	if (!post || !post.data) return; // not a post page (or unexpected shape) — nothing to do

	browser.runtime.sendMessage({ action: "processPostData", data: post });
}

detectAndSendCreator();

// a creator/listing page (/c/ or /cw/) is never a single post, so skip parsing __NEXT_DATA__
// there — that parse can be sizeable. anywhere else, feature-detect the embedded post. this
// stays safe: it only skips when we're certain it's a creator page, so if Patreon ever
// changes its creator url scheme the regex won't match and we fall through to the check.
if (creatorUrlRegex.exec(window.location.href) === null) {
	detectAndSendPost();
}

// re-detect on SPA navigation (Patreon uses client-side routing). only the creator is
// re-evaluated here; the post envelope above is server-rendered once and not refreshed on
// client-side navigation, so re-reading it would only re-send the initial post.
let lastUrl = window.location.href;
new MutationObserver(() => {
	if (window.location.href !== lastUrl) {
		lastUrl = window.location.href;
		detectAndSendCreator();
	}
}).observe(document, { subtree: true, childList: true });

// popup can ask for current creator directly
browser.runtime.onMessage.addListener(request => {
	if (request.action === "getCreator") {
		let match = creatorUrlRegex.exec(window.location.href);
		return Promise.resolve({ creator: match ? match[1] : null });
	}
});
