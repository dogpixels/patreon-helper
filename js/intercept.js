/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var streamUrls = [
    '*://*.patreon.com/api/stream*',
    '*://*.patreon.com/api/posts*'
];
var postsNameRegex = /\/join\/(\w+)\/checkout*/;

var db;
var names = {};

function interceptStreamResponse(details) {
    if (debug) console.log("intercepting api request '" + details.requestId + "'");

    let responseDictionary = {};
    let filter = browser.webRequest.filterResponseData(details.requestId);
    
    responseDictionary[details.requestId] = "";

    filter.ondata = event => {
        let decoder = new TextDecoder("utf-8");
        let encoder = new TextEncoder();

        let str = decoder.decode(event.data, {stream: true});

        if (debug) console.info("writing " + str.length + " bytes to response dictionary id " + details.requestId);

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
                console.error("failed to parse response requestId '" + key + "'", responseDictionary[key]);
                return;
            }
            extractDownloadInfo(responseDictionary[key]);
        }
    }
}

function extractDownloadInfo(response) {
    if (debug) console.info("scanning data", response);

    /* search posts for primary media */
    if (response.hasOwnProperty('data')) { // /api/posts
        response.data.forEach(data => {
            if (
                data.type == "post" &&
                data.hasOwnProperty('attributes') &&
                data.attributes.hasOwnProperty('post_file') &&
                data.attributes.post_file && // might be null
                data.attributes.post_file.hasOwnProperty('name') &&
                data.attributes.post_file.hasOwnProperty('url')
            ) {
                let match;
                let name = unknownCreator;

                if (data.attributes.hasOwnProperty('upgrade_url') && (match = postsNameRegex.exec(data.attributes.upgrade_url)) !== null) {
                    name = match[1];
                }

                if (debug) console.log("found media on post:", {
                    name: name,
                    file: data.attributes.post_file.name,
                    url: data.attributes.post_file.url
                });

                addToDownloads(downloadPrefix + name + "/" + data.attributes.post_file.name, data.attributes.post_file.url);

                /* search post text for media links */
                if (data.attributes.hasOwnProperty('content') && data.attributes.content != null) {
                    findMediaUrls(data.attributes.content).forEach(url => {
                        addToDownloads(downloadPrefix + name + "/" + url.split('/').pop().split('#')[0].split('?')[0], url);
                    });
                }

                // note content creator name for secondary media (post has multiple media)
                if (
                    data.attributes.hasOwnProperty('post_metadata') &&
                    data.attributes.post_metadata &&
                    data.attributes.post_metadata.hasOwnProperty('image_order') &&
                    data.attributes.post_metadata.image_order
                ) {
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
                        data.relationships.images.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    }
                    if (
                        data.relationships.hasOwnProperty('audio') &&
                        data.relationships.audio &&
                        data.relationships.audio.hasOwnProperty('data') &&
                        data.relationships.audio.data
                    ) {
                        data.relationships.audio.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    }
                    if (
                        data.relationships.hasOwnProperty('attachments') &&
                        data.relationships.attachments &&
                        data.relationships.attachments.hasOwnProperty('data') &&
                        data.relationships.attachments.data
                    ) {
                        data.relationships.attachments.data.forEach(dat => {
                            names[dat.id] = name;
                        });
                    }
                }
            }
        });
    }

    /* search stream (home feed) for media */
    if (response.hasOwnProperty('included')) {
        response.included.forEach(incl => {
            if (
                incl.type == "user" && 
                incl.hasOwnProperty('id') && 
                incl.hasOwnProperty('attributes') && 
                incl.attributes.hasOwnProperty('full_name')
            ) {
                if (debug) console.log("found user '"+ incl.id + "'", incl.attributes.full_name);
                names[incl.id] = incl.attributes.full_name;
            }
    
            // /api/stream
            if (
                incl.type == "media" && 
                incl.hasOwnProperty('attributes') &&
                incl.attributes.hasOwnProperty('download_url') && 
                incl.attributes.hasOwnProperty('file_name')
            ) {
                let name = unknownCreator;

                if (incl.hasOwnProperty('id') && names.hasOwnProperty(incl.id))
                    name = names[incl.id];
    
                if (debug) console.log("found media on stream:", {
                    name: name,
                    file: incl.attributes.file_name,
                    url: incl.attributes.download_url
                });
    
                addToDownloads(downloadPrefix + name + "/" + incl.attributes.file_name, incl.attributes.download_url);
            }

            // attachments
            if (
                incl.type == "attachment" &&
                incl.hasOwnProperty('attributes') &&
                incl.attributes.hasOwnProperty('name') &&
                incl.attributes.hasOwnProperty('url')
            ) {
                let name = unknownCreator;

                if (incl.hasOwnProperty('id') && names.hasOwnProperty(incl.id))
                    name = names[incl.id];

                if (debug) console.log("found attachment:", {
                    name: name,
                    file: incl.attributes.name,
                    url: incl.attributes.url
                });

                addToDownloads(downloadPrefix + name + "/" + incl.attributes.name, incl.attributes.url);
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

    if (debug) console.log("found links in text:", matches);

    matches.forEach(url => {
        if (mediaExtensions.includes(url.match(/\.([^\s\.]+)$/i)[1]))
            ret.push(url);
    });

    if (debug) console.log("extracted media links from text:", ret);
    
    return ret;
}

async function addToDownloads(filename, url) {
    if (typeof db === 'undefined') {
        let dbOpen = window.indexedDB.open("patreonex", dbVersion);

        dbOpen.onsuccess = () => {
            db = dbOpen.result;
            if (debug)
                console.info("connection to database succeeded");
        };

        dbOpen.onerror = event => {
            console.error("failed to connect to database", event);
            return;
        };
    }

    // check if filename already in database, add otherwise
    let count = await db.transaction("downloads").objectStore("downloads").index("filename").count(IDBKeyRange.only(filename));

    count.onsuccess = () => {
        if (count.result == 0) { // if not already in db
            
            if (debug)
                console.info("adding to db: " + filename + ",", url);

            let op = db.transaction("downloads", "readwrite").objectStore("downloads").add({
                filename: filename,
                url: url,
                state: 0
            });

            op.onerror = () => {
                console.warn("error adding entry to database", op);
            };
        }
    };   
}

browser.webRequest.onBeforeRequest.addListener(
    interceptStreamResponse, 
    {urls: streamUrls}, 
    ["blocking"]
)