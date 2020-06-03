/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

var db;

var dbOpen = indexedDB.open("patreonex", dbVersion);

dbOpen.onupgradeneeded = () => {
    if (debug) console.info("initializing downloads structure");

    let store = dbOpen.result.createObjectStore("downloads", {keyPath: "id", autoIncrement: true});
    store.createIndex("filename", "filename", {unique: true}); // note [1]
    store.createIndex("url", "url", {unique: false});
    store.createIndex("state", "state", {unique: false});
}

dbOpen.onsuccess = () => {
    db = dbOpen.result;
}

// background download worker
setInterval(() => {
    let request = db.transaction("downloads", "readwrite").objectStore("downloads").index("state").openCursor(IDBKeyRange.upperBound(0)); // get all with state <= 0

    let i = 0;
    request.onsuccess = (event) => {
        let downloaded = false;

        if (i++ >= concurrentDownloads || !event.target.result)
            return;

        let cursor = event.target.result;
        let filename = cursor.value.filename;
        let url = cursor.value.url;

        if (debug) console.log("downloading '" +  filename + "', url:", url);
        ExportLog.info(`[download worker] downloading; filename: '${filename}', url: '${url}'`)

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
                    console.warn("download failed", dl);
                    ExportLog.error(`[download worker] download failed; filename: '${filename}', url: '${url}'; browser.downloads.download() returned:`, dl)
                }
            );

            downloaded = true;
        }
        // something else (e.g. http-302) - open in tab // todo: [3]
        else {
            if (downloadAttachments) {
                browser.tabs.create({
                    active: false,
                    url: url
                }).then(
                    (tab) => {
                        setTimeout(() => {
                            try {browser.tabs.remove(tab.id);} // try closing the tab
                            catch {} // closing the tab was a service to the user anyway
                        }, 3000); // wait a bit for the download to begin
                    },
                    () => {
                        console.warn("failed to open tab for extended download");
                        ExportLog.error(`[download worker] failed to open tab for extended download; filename: '${filename}', url: '${url}'`)
                    }
                )
                downloaded = true;
            }
        }
        
        if (downloaded) {
            // todo: [2-2]
            ExportLog.info(`[download worker] marking as successfully downloaded; filename: '${filename}', url: '${url}'`)
            cursor.value.state = 1;
            cursor.update(cursor.value);
        }

        cursor.continue();
    }
}, 3000); // 3 sec

/*
 *  [1] : potential issue: when the same artist uploads an image with the
 *  same filename, the second post will be ignored because the unique filename was
 *  already present in database.
 *
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