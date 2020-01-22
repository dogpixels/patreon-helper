/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */

 /* global */
var debug = false;
var dbVersion = 1;

 /* download */
var concurrentDownloads = 1;
var downloadInterval = 6000; // ms
var downloadPrefix = 'patreon/';

console.info("patreon helper 1.2 loaded; debug: ", debug);