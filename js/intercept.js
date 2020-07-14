/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var streamUrls = [
    '*://*.patreon.com/api/stream*',
    '*://*.patreon.com/api/posts*'
];
var postsNameRegex = /\/join\/(\w+)\/checkout*/;
var identifierRegex = /\/post\/\d*\/(\w*)\/|file\?(h\=\d*\&i\=\w*)/;

var db;
var names = {};

function interceptStreamResponse(details) {
    if (debug) console.log("intercepting api request '" + details.requestId + "'");
    ExportLog.info(`[intercept:18] intercepting api request id '${details.requestId}'`);

    let responseDictionary = {};
    let filter = browser.webRequest.filterResponseData(details.requestId);
    
    responseDictionary[details.requestId] = "";

    filter.ondata = event => {
        let decoder = new TextDecoder("utf-8");
        let encoder = new TextEncoder();

        let str = decoder.decode(event.data, {stream: true});

        if (debug) console.info("writing " + str.length + " bytes to response dictionary id " + details.requestId);
        ExportLog.info(`[intercept:32] writing '${str.length}' bytes to response dictionary id '${details.requestId}'`);

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
                ExportLog.error(`[intercept:55] failed to parse response requestId '${key}', responseDictionary[key]:`, responseDictionary[key]);
                return;
            }
            ExportLog.log(`[intercept:58] response '${key}' parsed successfully`);
            extractDownloadInfo(responseDictionary[key]);
        }
    }
}

function extractDownloadInfo(response) {
    if (debug) console.info("scanning data", response);
    ExportLog.info(`[intercept:66] scanning response:`, response);

    /* search posts for primary media */
    if (response.hasOwnProperty('data')) { // /api/posts
        ExportLog.log(`[intercept:70] 'data' found in response`);
        response.data.forEach(data => {
            if (
                data.type == "post" &&
                data.hasOwnProperty('attributes') &&
                data.attributes.hasOwnProperty('post_file') &&
                data.attributes.post_file && // might be null
                data.attributes.post_file.hasOwnProperty('name') &&
                data.attributes.post_file.hasOwnProperty('url')
            ) {
                ExportLog.log(`[intercept:80] 'post_file' found in post`);
                let match;
                let name = unknownCreator;

                if (data.attributes.hasOwnProperty('upgrade_url') && (match = postsNameRegex.exec(data.attributes.upgrade_url)) !== null) {
                    ExportLog.log(`[intercept:85] trying to find creator; matching against data.attributes.upgrade_url: `, data.attributes.upgrade_url);
                    name = match[1];
                }
                
                if (debug) console.log("found media on post:", {
                    name: name,
                    file: data.attributes.post_file.name,
                    url: data.attributes.post_file.url
                });
                ExportLog.log(`[intercept:94] found media on post:`, {
                    name: name,
                    file: data.attributes.post_file.name,
                    url: data.attributes.post_file.url
                });

                // 07/2020 "Nikofix" for Patreon's odd fetish to slap some wrong file name onto the first url on a post with multiple images
                if (
                    data.attributes.hasOwnProperty('post_metadata') &&
                    data.attributes.post_metadata.hasOwnProperty('image_order') &&
                    data.attributes.post_metadata.image_order.length > 1
                ) {
                    if (debug) console.warn(`the aforementioned media on post has been identified affected by 07/2020 Nikofix and has been skipped`);
                    ExportLog.warn(`[intercept:107] the aforementioned media on post has been identified affected by 07/2020 Nikofix and has been skipped`);
                }
                else {
                    addToDownloads(downloadPrefix + name + "/" + data.attributes.post_file.name, data.attributes.post_file.url);
                }

                /* search post text for media links */
                if (data.attributes.hasOwnProperty('content') && data.attributes.content != null) {
                    ExportLog.log(`[intercept:115] 'content' found in post response; searching for media links; data.attributes.content:`, data.attributes.content);
                    findMediaUrls(data.attributes.content).forEach(url => {
                        ExportLog.info(`[intercept:117] url found in post content, url:`, url);
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
                    ExportLog.log(`[intercept:129] 'post_metadata' found in response; image_order:`, data.attributes.post_metadata.image_order);
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
                        ExportLog.log(`[intercept:146] 'images' found in response post relationships; images:`, data.relationships.images.data);
                        if (Array.isArray(data.relationships.images.data)) {
                            data.relationships.images.data.forEach(dat => {
                                names[dat.id] = name;
                            });
                        } else if (data.relationships.images.data.hasOwnProperty('id')) {
                                names[data.relationships.images.data.id] = name;
                        } else {
                            exlog.error(`[intercept:154] could not handle images in resounse post relationship; images.data: `, data.relationships.images.data);
                        }
                    }
                    if (
                        data.relationships.hasOwnProperty('audio') &&
                        data.relationships.audio &&
                        data.relationships.audio.hasOwnProperty('data') &&
                        data.relationships.audio.data
                    ) {
                        ExportLog.log(`[intercept:163] 'audio' found in response post relationships; audios:`, data.relationships.audio.data);
                        if (Array.isArray(data.relationships.audio.data)) {
                            data.relationships.audio.data.forEach(dat => {
                                names[dat.id] = name;
                            });
                        } else if (data.relationships.audio.data.hasOwnProperty('id')) {
                                names[data.relationships.audio.data.id] = name;
                        } else {
                            exlog.error(`[intercept:171] could not handle audio in resounse post relationship; audio.data: `, data.relationships.audio.data);
                        }
                    }
                    if (
                        data.relationships.hasOwnProperty('attachments') &&
                        data.relationships.attachments &&
                        data.relationships.attachments.hasOwnProperty('data') &&
                        data.relationships.attachments.data
                    ) {
                        ExportLog.log(`[intercept:180] 'attachments' found in response post relationship: attachments:`, data.relationships.attachments.data);
                        if (Array.isArray(data.relationships.attachments.data)) {
                            data.relationships.attachments.data.forEach(dat => {
                                names[dat.id] = name;
                            });
                        } else if (data.relationships.attachments.data.hasOwnProperty('id')) {
                                names[data.relationships.attachments.data.id] = name;
                        } else {
                            exlog.error(`[intercept:188] could not handle attachment in resounse post relationship; attachments.data: `, data.relationships.attachments.data);
                        }
                    }
                }
            }
        });
    }

    /* search stream (home feed) for media */
    if (response.hasOwnProperty('included')) {
        ExportLog.info(`[intercept:198] 'included' found in response`);
        response.included.forEach(incl => {
            if (
                incl.type == "user" && 
                incl.hasOwnProperty('id') && 
                incl.hasOwnProperty('attributes') && 
                incl.attributes.hasOwnProperty('full_name')
            ) {
                if (debug) console.log("found user '"+ incl.id + "'", incl.attributes.full_name);
                ExportLog.info(`[intercept:207] found user; id: '${incl.id}', full_name: ${incl.attributes.full_name}`);
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
                ExportLog.info(`[intercept:228] found media on stream:`, {
                    name: name,
                    file: incl.attributes.file_name,
                    url: incl.attributes.download_url
                });

                // workaround for when patreon started to null attributes.file_name somewhen in 03/2020
                if (incl.attributes.file_name == null) {
                    if (!useLostAndFound) {
                        ExportLog.warn(`[intercept:237] /{file_name} was null, but user setting useLostAndFound is disabled; operation skipped`)
                        return;
                    }

                    incl.attributes.file_name = new Date().getTime() + '-' + Math.floor(Math.random() * 1024) + '.jpg';
                    if (debug) console.warn(name + "/{file_name} was null, replaced it by:", name + LostAndFoundSuffix + '/' + incl.attributes.file_name);
                    ExportLog.warn(`[intercept:243] /{file_name} was null, replanced it by '${name}${LostAndFoundSuffix}/${incl.attributes.file_name}'`);
                    name += LostAndFoundSuffix;
                }

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
                ExportLog.info(`found attachment:`, {
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
    ExportLog.info(`[findMediaUrls()] found links in text:`, matches);

    matches.forEach(url => {
        if (mediaExtensions.includes(url.match(/\.([^\s\.]+)$/i)[1]))
            ret.push(url);
    });

    if (debug) console.log("extracted media links from text:", ret);
    ExportLog.info(`[findMediaUrls()] extracted media links from text: `, ret);
    
    return ret;
}

async function addToDownloads(filename, url) {
    if (debug) console.info(`[addToDownloads()] called with filename: '${filename}' and url: '${url}'`);
    ExportLog.info(`[addToDownloads()] called with filename: '${filename}' and url: '${url}'`);

    let identifier = determineFileIdentifier(filename, url);

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
    let count = await db.transaction("downloads").objectStore("downloads").index("identifier").count(IDBKeyRange.only(identifier));

    count.onsuccess = () => {
        if (count.result == 0) { // if not already in db
            if (debug) console.info("adding to db: " + identifier + ", " + filename + ",", url);
            ExportLog.info(`[addToDownloads()] adding to database; identifier: '${identifier}', filename: '${filename}', url: '${url}'`)

            let op = db.transaction("downloads", "readwrite").objectStore("downloads").add({
                identifier: identifier,
                filename: filename,
                url: url,
                state: 0
            });

            op.onerror = () => {
                console.warn("error adding entry to database", identifier);
                ExportLog.error(`[addToDownloads()] error adding to database; identifier: '${identifier}', filelename: '${filename}', url: '${url}'`)
            };
        } else {
            ExportLog.warn(`[addToDownloads()] skipped adding to database due to count.result > 0; identifier: '${identifier}', filename '${filename}', url: '${url}'`)
        }
    };   
}

function determineFileIdentifier(filename, url) {
    let matches = identifierRegex.exec(url);

    // case 1: probably an external url - use url to identify
    if (matches === null) {
        if (debug) console.warn("identifier search: probably external url; whole url will be used as identifier:", url);
        ExportLog.warn(`identifier search: probably external url; whole url will be used as identifier: ${url}`);
        return url;
    }

    // case 2: file hosted on patreonusercontent.com
    if (typeof matches[1] !== 'undefined') {
        if (debug) console.info("identifier search: determined '" + matches[1] + "' (case patreonusercontent.com) for url", url);
        ExportLog.info(`identifier search: determined '${matches[1]}' (case patreonusercontent.com) for url: ${url}`);
        return matches[1];
    }

    // case 3: file hosted on patreon.com
    if (typeof matches[2] !== 'undefined') {
        if (debug) console.info("identifier search: determined '" + matches[2] + "' (case patreon.com) for url", url);
        ExportLog.info(`identifier search: determined '${matches[2]}' (case patreon.com) for url: ${url}`);
        return matches[2];
    }

    // that should not occur
    if (debug) console.error("identifier search: unhandled matches, filename will be used; matches:", matches);
    ExportLog.error(`identifier search: unhandled matches, filename will be used; matches:`, matches);
    return filename;
}

browser.webRequest.onBeforeRequest.addListener(
    interceptStreamResponse, 
    {urls: streamUrls}, 
    ["blocking"]
)