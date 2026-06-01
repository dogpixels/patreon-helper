/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var streamUrls = [
    '*://*.patreon.com/api/stream*',
    '*://*.patreon.com/api/posts*'
];
var identifierRegex = /\/post\/\d*\/(\w*)\/|file\?(h\=\d*\&i\=\w*)/;

// extracts the creator's vanity slug from any patreon profile/checkout/join url
function extractVanityFromUrl(url) {
    if (!url) return null;
    let m;
    if ((m = /patreon\.com\/checkout\/([^/?#]+)/.exec(url)) !== null) return m[1];
    if ((m = /patreon\.com\/([^/?#]+)\/join\b/.exec(url)) !== null) return m[1];
    if ((m = /patreon\.com\/(?:c|cw)\/([^/?#]+)/.exec(url)) !== null) return m[1];
    return null;
}

// resolves the included entry (e.g. campaign, user) a post points to via relationships
function findIncluded(response, post, type) {
    if (!response.included || !post.relationships ||
        !post.relationships[type] || !post.relationships[type].data) return null;
    let id = post.relationships[type].data.id;
    return response.included.find(i => i.type === type && i.id === id) || null;
}

// extracts the vanity slug from a campaign's canonical profile url, which is a bare
// patreon.com/<slug> with nothing following the slug (anchored to the url's end)
function extractCampaignVanity(campaign) {
    let url = campaign && campaign.attributes && campaign.attributes.url;
    if (!url) return null;
    let m = /patreon\.com\/([^/?#]+)\/?$/.exec(url);
    return m ? m[1] : null;
}

// determines the creator name for a post, preferring the stable vanity slug
function resolveCreatorName(post, response) {
    let campaign = findIncluded(response, post, 'campaign');
    let user = findIncluded(response, post, 'user');

    // prefer the vanity slug: post checkout urls first (always present on the post),
    // then the linked campaign's canonical profile url (only present when sideloaded)
    let vanity = extractVanityFromUrl(post.attributes && post.attributes.upgrade_url)
        || extractVanityFromUrl(post.attributes && post.attributes.pledge_url)
        || extractCampaignVanity(campaign);
    if (vanity) return vanity;

    // fall back to a display name if no vanity slug is available anywhere — still
    // better than unknown (campaign name preferred, then the post author's user)
    if (campaign && campaign.attributes && campaign.attributes.name) return campaign.attributes.name;
    if (user && user.attributes && user.attributes.full_name) return user.attributes.full_name;

    // last resort: the creator detected from the page url, else unknown
    return pageCreator ? pageCreator : unknownCreator;
}

var db;
var names = {};

function interceptStreamResponse(details) {
    console.info(`intercepting api request id '${details.requestId}'`);

    let responseDictionary = {};
    let filter = browser.webRequest.filterResponseData(details.requestId);
    
    responseDictionary[details.requestId] = "";

    filter.ondata = event => {
        let decoder = new TextDecoder("utf-8");
        let encoder = new TextEncoder();

        let str = decoder.decode(event.data, {stream: true});

        console.info(`writing '${str.length}' bytes to response dictionary id '${details.requestId}'`);

        responseDictionary[details.requestId] += str;

        // pass on response to original receiver
        filter.write(encoder.encode(str));
    }

    // close filter when all data is received
    filter.onstop = () => {
        filter.disconnect();
        decodeStreamResponse(responseDictionary);
    }
}

function decodeStreamResponse(responseDictionary) {
    for (const key in responseDictionary) {
        if (responseDictionary.hasOwnProperty(key)) {
            try {
                responseDictionary[key] = JSON.parse(responseDictionary[key]);
            } 
            catch {
                console.error(`failed to parse response requestId '${key}', responseDictionary[key]:`, responseDictionary[key]);
                return;
            }
            console.log(`response '${key}' parsed successfully`);
            extractDownloadInfo(responseDictionary[key]);
        }
    }
}

function extractDownloadInfo(response) {
    console.info(`scanning response:`, response);

    /* search posts for primary media */
    if (response.hasOwnProperty('data')) { // /api/posts
        console.log(`'data' found in response`);
        response.data.forEach(data => {
            if (data.type != "post" || !data.hasOwnProperty('attributes')) {
                return;
            }

            // resolve the creator name for every post up front, so secondary media can
            // still be attributed even when the post carries no downloadable post_file
            // (e.g. collection feeds, where post_file lacks a 'name' and the real images
            // arrive separately via the 'included' array, looked up through names[])
            let name = resolveCreatorName(data, response);
            console.log(`resolved creator name: `, name);

            if (
                data.attributes.hasOwnProperty('post_file') &&
                data.attributes.post_file && // might be null
                data.attributes.post_file.hasOwnProperty('name') &&
                data.attributes.post_file.hasOwnProperty('url')
            ) {
                console.log(`'post_file' found in post`);

                console.log("found media on post:", {
                    name: name,
                    file: data.attributes.post_file.name,
                    url: data.attributes.post_file.url
                });

                // 07/2020 "Nikofix" for Patreon's odd fetish to slap some wrong file name onto the first url on a post with multiple images
                if (
                    data.attributes.hasOwnProperty('post_metadata') &&
                    data.attributes.post_metadata && // might be null
                    data.attributes.post_metadata.hasOwnProperty('image_order') &&
                    data.attributes.post_metadata.image_order.length > 1
                ) {
                    console.warn(`the aforementioned media on post has been identified affected by 07/2020 Nikofix and has been skipped`);
                }
                else {
                    addToDownloads(name, buildDownloadPath(name, baseName(data.attributes.post_file.name), data.attributes.post_file.url), data.attributes.post_file.url, objectIdentifier("media", data.attributes.post_file.media_id));
                }
            }

            /* search post text for media links */
            if (data.attributes.hasOwnProperty('content') && data.attributes.content != null) {
                console.log(`'content' found in post response; searching for media links; data.attributes.content:`, data.attributes.content);
                findMediaUrls(data.attributes.content).forEach(url => {
                    console.info(`url found in post content, url:`, url);
                    let file = url.split('/').pop().split('#')[0].split('?')[0];
                    addToDownloads(name, buildDownloadPath(name, file, url), url);
                });
            }

            // note content creator name for secondary media (post has multiple media)
            if (
                data.attributes.hasOwnProperty('post_metadata') &&
                data.attributes.post_metadata &&
                data.attributes.post_metadata.hasOwnProperty('image_order') &&
                data.attributes.post_metadata.image_order
            ) {
                console.log(`'post_metadata' found in response; image_order:`, data.attributes.post_metadata.image_order);
                data.attributes.post_metadata.image_order.forEach(id => {
                    names[id] = name;
                });
            }

            // note content creator name for attachments
            if (
                data.hasOwnProperty('relationships') &&
                data.relationships
            ) {
                if (
                    data.relationships.hasOwnProperty('images') &&
                    data.relationships.images &&
                    data.relationships.images.hasOwnProperty('data') &&
                    data.relationships.images.data
                ) {
                    console.log(`'images' found in response post relationships; images:`, data.relationships.images.data);
                    if (Array.isArray(data.relationships.images.data)) {
                        data.relationships.images.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    } else if (data.relationships.images.data.hasOwnProperty('id')) {
                            names[data.relationships.images.data.id] = name;
                    } else {
                        console.error(`could not handle images in response post relationship; images.data: `, data.relationships.images.data);
                    }
                }
                if (
                    data.relationships.hasOwnProperty('audio') &&
                    data.relationships.audio &&
                    data.relationships.audio.hasOwnProperty('data') &&
                    data.relationships.audio.data
                ) {
                    console.log(`'audio' found in response post relationships; audios:`, data.relationships.audio.data);
                    if (Array.isArray(data.relationships.audio.data)) {
                        data.relationships.audio.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    } else if (data.relationships.audio.data.hasOwnProperty('id')) {
                            names[data.relationships.audio.data.id] = name;
                    } else {
                        console.error(`could not handle audio in response post relationship; audio.data: `, data.relationships.audio.data);
                    }
                }
                if (
                    data.relationships.hasOwnProperty('attachments') &&
                    data.relationships.attachments &&
                    data.relationships.attachments.hasOwnProperty('data') &&
                    data.relationships.attachments.data
                ) {
                    console.log(`attachments found in response post relationship: attachments:`, data.relationships.attachments.data);
                    if (Array.isArray(data.relationships.attachments.data)) {
                        data.relationships.attachments.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    } else if (data.relationships.attachments.data.hasOwnProperty('id')) {
                            names[data.relationships.attachments.data.id] = name;
                    } else {
                        exlog.error(`could not handle attachment in response post relationship; attachments.data: `, data.relationships.attachments.data);
                    }
                }
            }
        });
    }

    /* search stream (home feed) for media */
    if (response.hasOwnProperty('included')) {
        console.info(`'included' found in response`);
        response.included.forEach(incl => {
            if (
                incl.type == "user" && 
                incl.hasOwnProperty('id') && 
                incl.hasOwnProperty('attributes') && 
                incl.attributes.hasOwnProperty('full_name')
            ) {
                console.info(`found user; id: '${incl.id}', full_name: ${incl.attributes.full_name}`);
                names[incl.id] = incl.attributes.full_name;
            }
    
            // /api/stream
            if (
                incl.type == "media" &&
                incl.hasOwnProperty('attributes') &&
                incl.attributes.download_url != null && // null for streaming (e.g. Mux/.m3u8) media, which can't be downloaded directly
                incl.attributes.hasOwnProperty('file_name')
            ) {
                let name = pageCreator? pageCreator : unknownCreator;

                if (incl.hasOwnProperty('id') && names.hasOwnProperty(incl.id))
                    name = names[incl.id];
    
                console.log("found media on stream:", {
                    name: name,
                    file: incl.attributes.file_name,
                    url: incl.attributes.download_url
                });

                // patreon nulls attributes.file_name for some media (since ~03/2020). we still have a
                // stable media id, so name the file after it (<id>.<ext>) and treat it like any other
                // download. the extension is taken from the url, since the original name is unknown.
                if (incl.attributes.file_name == null) {
                    incl.attributes.file_name = incl.id + "." + (fileExtensionOf(incl.attributes.download_url) || "jpg");
                    console.warn(`file_name was null, replaced it by '${incl.attributes.file_name}'`);
                }

                addToDownloads(name, buildDownloadPath(name, baseName(incl.attributes.file_name), incl.attributes.download_url), incl.attributes.download_url, objectIdentifier("media", incl.id));
            }

            // attachments
            if (
                incl.type == "attachment" &&
                incl.hasOwnProperty('attributes') &&
                incl.attributes.hasOwnProperty('name') &&
                incl.attributes.hasOwnProperty('url')
            ) {
                let name = pageCreator? pageCreator : unknownCreator;

                if (incl.hasOwnProperty('id') && names.hasOwnProperty(incl.id))
                    name = names[incl.id];

                console.log("found attachment:", {
                    name: name,
                    file: incl.attributes.name,
                    url: incl.attributes.url
                });

                addToDownloads(name, buildDownloadPath(name, baseName(incl.attributes.name), incl.attributes.url), incl.attributes.url, objectIdentifier("attachment", incl.id));
            }
        });
    }
}

function findMediaUrls(text) {
    let ret = [];
    let regex = /href=\"([^"]+)\"/gi;

    let matches = regex.exec(text);

    if (matches === null)
        return ret;

    console.log("found links in text:", matches);

    matches.forEach(url => {
        if (mediaExtensions.includes(url.match(/\.([^\s\.]+)$/i)[1]))
            ret.push(url);
    });

    console.log("extracted media links from text:", ret);
    
    return ret;
}

async function addToDownloads(creator, filename, url, identifier) {
    registerCreator(creator);

    console.info(`Queueing: creator: "${creator}", filename: "${filename}", url: "${url}"`);

    // Mux-hosted video (stream.mux.com / image.mux.com) uses player-only signed tokens; a direct
    // fetch returns {"error":...,"type":"not_authorized"}. these can't be downloaded as a plain file,
    // and since the host isn't patreonusercontent.com they'd otherwise be opened in a useless tab.
    if (url && url.includes('mux.com')) {
        console.info(`Mux URL is not directly downloadable; queueing skipped; url: '${url}'`);
        return;
    }

    // greedy: skip only creators the user explicitly disabled
    if (collectionMode === "greedy" && knownCreators[creator] === false) {
        console.info(`Collection mode greedy, but creator "${creator}" is disabled; queueing skipped.`);
        return;
    }

    // selective: skip everyone not explicitly enabled via the popup
    if (collectionMode === "selective" && knownCreators[creator] !== true) {
        console.info(`Collection mode selective, creator "${creator}" not enabled; queueing skipped.`);
        return;
    }

    // "Download File Types" filter: skip groups the user disabled in the options page
    if (!isMediaTypeEnabled(filename, url)) {
        console.info(`media type "${getMediaType(filename, url)}" is disabled; queueing skipped for filename: '${filename}'`);
        return;
    }

    if (!db) {
        console.warn(`database not ready, skipping; filename: '${filename}', url: '${url}'`);
        return;
    }

    // prefer a stable Patreon object id (media/attachment) as the dedup key when the caller
    // provides one; only external links scraped from post text fall back to parsing the url.
    if (!identifier)
        identifier = determineFileIdentifier(filename, url);

    let store = db.transaction("downloads", "readwrite").objectStore("downloads");
    let getRequest = store.index("identifier").get(IDBKeyRange.only(identifier));

    getRequest.onsuccess = () => {
        let record = getRequest.result;

        if (!record) {
            console.info(`adding to database; identifier: '${identifier}', filename: '${filename}', url: '${url}'`);
            let op = store.add({ identifier, filename, url, state: 0 });
            op.onsuccess = () => downloadNext();
            op.onerror = () => {
                console.error(`error adding to database; identifier: '${identifier}', filename: '${filename}', url: '${url}'`);
            };
        } else if (record.state === 3 && record.url !== url) {
            // previously failed, but Patreon provided a fresh url — update and retry
            console.info(`previously failed, fresh url detected — resetting; identifier: '${identifier}'`);
            record.url = url;
            record.state = 0;
            let op = store.put(record);
            op.onsuccess = () => downloadNext();
        } else {
            // already known (pending, in-progress, done, or failed with same url) — skip
            console.warn(`skipped; already in database; identifier: '${identifier}', state: ${record.state}`);
        }
    };
}

function determineFileIdentifier(filename, url) {
    let matches = identifierRegex.exec(url);

    // case 1: probably an external url - use url to identify
    if (matches === null) {
        console.warn("identifier search: probably external url; whole url will be used as identifier:", url);
        return url;
    }

    // case 2: file hosted on patreonusercontent.com
    if (typeof matches[1] !== 'undefined') {
        console.info("identifier search: determined '" + matches[1] + "' (case patreonusercontent.com) for url", url);
        return matches[1];
    }

    // case 3: file hosted on patreon.com
    if (typeof matches[2] !== 'undefined') {
        console.info("identifier search: determined '" + matches[2] + "' (case patreon.com) for url", url);
        return matches[2];
    }

    // that should not occur
    console.error("identifier search: unhandled matches, filename will be used; matches:", matches);
    return filename;
}

// builds a stable dedup identifier from a Patreon object id (e.g. "media-672366612"),
// or undefined when no id is available (then the caller falls back to the url).
function objectIdentifier(type, id) {
    return id != null ? type + "-" + id : undefined;
}

browser.webRequest.onBeforeRequest.addListener(
    interceptStreamResponse, 
    {urls: streamUrls}, 
    ["blocking"]
)