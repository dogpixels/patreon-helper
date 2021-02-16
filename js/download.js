/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var db;

var dbOpen = indexedDB.open("patreonex", dbVersion);

dbOpen.onupgradeneeded = () => {
    console.info(`initializing downloads structure, version "${dbVersion}".`);

    // version 3 - added new index (identifier), hence the old object store must be dropped
    try {dbOpen.result.deleteObjectStore("downloads")}
    catch {console.warn("could not delete downloads object store - probably none present")}

    let store = dbOpen.result.createObjectStore("downloads", {keyPath: "id", autoIncrement: true});
    store.createIndex("identifier", "identifier", {unique: true});
    store.createIndex("filename", "filename", {unique: false});
    store.createIndex("url", "url", {unique: false});
    store.createIndex("state", "state", {unique: false});
}

dbOpen.onsuccess = () => {
    db = dbOpen.result;
}

// background download worker, started after user settings have been loaded in background-main.js or changed in options.js
function initializeDownloadInterval() {
    if (downloadIntervalId !== 0) {
        console.info(`[download worker] attempting to cancel downloadInterval with intervalID "${downloadIntervalId}"`);
        clearInterval(downloadIntervalId);
    }

    downloadIntervalId = setInterval(() => {
        let request = db.transaction("downloads", "readwrite").objectStore("downloads").index("state").openCursor(IDBKeyRange.upperBound(0)); // get all with state <= 0

        let i = 0;
        request.onsuccess = (event) => {
            let downloaded = false;

            if (i++ >= concurrentDownloads || !event.target.result)
                return;

            let cursor = event.target.result;
            let filename = cursor.value.filename;
            let url = cursor.value.url;

            console.info(`downloading; filename: '${filename}', url: '${url}'`)

            // served from patreonusercontent.com - download directly
            if (url.includes('patreonusercontent.com')) {
                let dl = browser.downloads.download({
                    filename: filename,
                    url: url,
                    saveAs: false
                })
                .then(
                    () => { // onsuccess
                        // todo: [2-1]
                    },
                    () => { // onerror
                        console.error(`download failed; filename: '${filename}', url: '${url}'; browser.downloads.download() returned:`, dl)
                    }
                );

                downloaded = true;
            }
            // something else (e.g. http-302) - open in tab // todo: [3]
            else {
                if (downloadAttachments) {
                    console.info("Downloading attachment", {filename: filename, url: url});
                    browser.tabs.create({
                        active: false,
                        url: url
                    })
                    downloaded = true;
                }
                else {
                    console.info(`Attachment download skipped due to user settings (downloadAttachments: false)`, {filename: filename, url: url});
                }
            }
            
            if (downloaded) {
                // todo: [2-2]
                console.info(`marking as successfully downloaded; filename: '${filename}', url: '${url}'`)
                cursor.value.state = 1;
                cursor.update(cursor.value);
            }

            cursor.continue();
        }
    }, downloadInterval);

    console.info(`started download interval (intervalID "${downloadIntervalId}") with "${downloadInterval}" ms interval`);
}
/*
 *  [2] : potential issue: a download will be signaled to have been downloaded (state = 1), 
 *  even though it is not confirmed that the download has successfully started (see [2-1], 
 *  which is in download().onsuccess method).
 *  Todo: either run the two lines following [2-2] only, if [2-1] has been run, or move
 *  the lines from below [2-2] to where [2-1] is; however, then cursor.value will be undefined. 
 * 
 *  [3] : bad ux: urls served through patreon.com/file redirect to the actual file on
 *  patreonusercontent.com per http-302; the current solution is to open a new tab
 *  with the known url and let it redirect towards the download; however, this
 *  opens a "save as" dialog to the user instead of simply downloading the file in the
 *  background.
 */