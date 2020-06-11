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
var bgdownloadtimer = setInterval(() => {
    let request = db.transaction("downloads", "readwrite").objectStore("downloads").index("state").openCursor(IDBKeyRange.upperBound(0)); // get all with state <= 0

    let i = 0;
    request.onsuccess = (event) => {
        if (i++ >= concurrentDownloads || !event.target.result)
            return;

        let cursor = event.target.result;
        let filename = cursor.value.filename;
        let url = cursor.value.url;

        if (debug) console.log("downloading '" +  filename + "', url:", url);

        browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
            let targetTabId = tabs[0].id;

            if (debug) console.log(`[download worker] sending downloadMessage to content script at tab.id ${targetTabId}; filename: '${filename}', url: '${url}'`);
            ExportLog.info(`[download worker] sending downloadMessage to content script at tab.id ${targetTabId}; filename: '${filename}', url: '${url}'`);
            
            fetch(url).then(
                (response) => {
                    response.blob().then(
                        (blob) => {
                            browser.tabs.sendMessage(targetTabId, {action: 'download', filename: filename, blob: blob})
                            .then(reply => {
                                if (debug) console.info("[download worker] reply (confirmation?) to downloadMessage received", reply);
                                ExportLog.info(`[download worker] reply (confirmation?) to downloadMessage received`, reply);
                                if (reply.action === 'confirm') {
                                    if (debug) console.info(`[download worker] marking as successfully downloaded; filename: '${filename}', url: '${url}'`);
                                    ExportLog.info(`[download worker] marking as successfully downloaded; filename: '${filename}', url: '${url}'`);
                                    cursor.value.state = 1;
                                    cursor.update(cursor.value);
                                }
                            })
                        }
                    )
                }
            );
        });
        console.info("cursor.continue()");
        cursor.continue();
    }
}, 3500); // 3.5 sec

/*
 *  [1] : potential issue: when the same artist uploads an image with the
 *  same filename, the second post will be ignored because the unique filename was
 *  already present in database.
 */