/*	
 *	Patreon Helper for Firefox
 * 	Version 1.0
 * 	draconigen@gmail.com
 */

var streamUrls = [
    '*://*.patreon.com/api/stream*',
    '*://*.patreon.com/api/posts*'
];
var postsNameRegex = /\/join\/([^\s\/]*)\/*/;

var db;
var names = {};

function interceptStreamResponse(details) {
    if (debug) console.log("intercepting stream api request '" + details.requestId + "'");

    let responseDictionary = {};
    let filter = browser.webRequest.filterResponseData(details.requestId);
    
    responseDictionary[details.requestId] = "";

    filter.ondata = event => {
        let decoder = new TextDecoder("utf-8");
        let encoder = new TextEncoder();

        let str = decoder.decode(event.data, {stream: true});

        if (debug) console.info("adding " + str.length + " bytes to response dictionary id " + details.requestId);

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

    response.included.forEach(incl => {
        if (incl.type == "user" && incl.id && incl.attributes.full_name) {
            if (debug) console.log("found user '"+ incl.id + "'", incl.attributes.full_name);
            names[incl.id] = incl.attributes.full_name;
        }

        // /api/stream
        if (incl.type == "media" && incl.attributes.download_url && incl.attributes.file_name) {

            /* TODO: artist names are already stored under names[user_id].
             * Find out the user_id of the poster of this media, then
             * change default name below from "patreon-downloads" to "_unknown"
             * and overwrite the name if it's in names.
             */
            let name = "_unknown";
            // if (names[]) // todo: put in user id in these brackets
            //     name = names[]; // todo: and in these

            if (debug) console.log("found media on stream:", {
                // name: name,
                file: incl.attributes.file_name,
                url: incl.attributes.download_url
            });

            addToDownloads(downloadPrefix + name + "/" + incl.attributes.file_name, incl.attributes.download_url);
        }

        // /api/posts
        if (incl.type == "post" && incl.attributes.post_file.name && incl.attributes.post_file.url) {
            let match;
            let name = "_unknown";

            if ((match = postsNameRegex.exec(incl.attributes.upgrade_url)) !== null) {
                name = match[0];
                console.log("matches!", match);
            }

            if (debug) console.log("found media on post:", {
                name: name,
                file: incl.attributes.post_file.name,
                url: incl.attributes.post_file.url
            });

            addToDownloads(downloadPrefix + name + "/" + incl.attributes.post_file.name, incl.attributes.post_file.url);
        }
    });
}

async function addToDownloads(filename, url) {
    if (typeof db === 'undefined') {
        let dbOpen = window.indexedDB.open("patreonex", dbVersion);
        
        dbOpen.onsuccess = () => {
            db = dbOpen.result;
            if (debug) console.info("connection to database succeeded");
        }
        
        dbOpen.onerror = event => {
            console.error("failed to connect to database", event);
            return;
        }
    }

    // check if filename already in database, add otherwise
    let count = await db.transaction("downloads").objectStore("downloads").index("filename").count(IDBKeyRange.only(filename));

    count.onsuccess = () => {
        if (count.result == 0) {
            if (debug) console.info("adding to db: '" + filename + "'", url);
            
            let op = db.transaction("downloads", "readwrite").objectStore("downloads").add({
                filename: filename,
                url: url,
                state: 0
            });

            op.onerror = () => {
                console.error("error adding entry to database", error); 
            }
        }
    }
}

browser.webRequest.onBeforeRequest.addListener(
    interceptStreamResponse, 
    {urls: streamUrls}, 
    ["blocking"]
)

if (debug) console.info("patreon extension loaded");