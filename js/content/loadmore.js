function clickLoadMore(href) {
	var xpath = "//div[contains(text(),'Load more')]";
	var matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

	console.log(matchingElement);

	if (matchingElement !== null)
		matchingElement.click();
}