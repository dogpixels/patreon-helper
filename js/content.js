/*	
 *	Patreon Helper for Firefox
 * 	draconigen@gmail.com
 */
browser.runtime.onMessage.addListener((data, sender) => {
	if (data.action === 'download') {
		let burl = window.URL.createObjectURL(data.blob);
		let link = document.createElement('a');
		document.body.append(link);
		link.classList.add('ph-link');

		link.href = burl;
		link.download = data.filename; // issue [1]
		link.target = '_blank';
		link.click();

		window.URL.revokeObjectURL(burl);
		document.body.removeChild(link);

		return Promise.resolve({action: 'confirm', filename: data.filename});
	}
})

/* Issues
 * [1] According to MDN [a], the content of a download attribute will be altered to reflect naming restrictions of the underlying filesystem.
 * For us, that means that slashes ('/') will be replaced by underscores ('_'), effectively rendering the frontend unable to sort downloads into subdirectories.
 *    [a] https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#Attributes
 *    [b] https://www.w3.org/TR/2014/REC-html5-20141028/links.html#links-created-by-a-and-area-elements
 */