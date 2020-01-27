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
        if (i++ >= concurrentDownloads || !event.target.result)
            return;

        let cursor = event.target.result;

        if (debug) console.log("downloading", cursor.value.filename);

        browser.downloads.download({
            filename: cursor.value.filename,
            url: cursor.value.url,
            saveAs: false
        })
        .then(
            () => { // onsuccess
                // todo: [2-1]
            },
            () => { // onerror
                console.log("failed to download '" + cursor.value.filename + "' from url: ", cursor.value.url); 
            }
        );
        
        // todo: [2-2]
        cursor.value.state = 1;
        cursor.update(cursor.value);

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
 */