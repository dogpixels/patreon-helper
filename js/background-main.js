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
var mediaExtensions = [
	'png', 'gif', 'jpg', 'jpeg', 'bmp', 'ai', 'ps', 'svg', 'tif', 'tiff', 'ico', 							// image
	'mp4', 'webm', 'avi', 'mpg', 'mpeg', 'swf', 'flv', '3gp', '3g2', 'h264', 'mkv', 'mov', 'm4v', 'wmv', 	// video 
	'ttf', 'otf', 'fon', 'fnt', 																			// font
	'mp3', 'ogg', 'wav', 'wma', 'mpa', 'mid', 'midi', 'cda', 'aif', 										// sound
	'zip', '7z', 'rar', 'tar.gz', 'z' 																		// compressed files
]

console.info("patreon helper 1.2 loaded; debug: ", debug);