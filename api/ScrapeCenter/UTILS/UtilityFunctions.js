async function getMatchList(page, xpath) {
    await page.waitForXPath(xpath);
    const parentElement = await page.$x(xpath);
  
    // Check the number of child div elements in the li node
    const childrenCount = await page.evaluate(
      (element) => element.children.length,
      parentElement[0]
    );
  
    let matchList = [];
    for (let i = 2; i <= childrenCount; i++) {
      let childXPath = `${xpath}/div[${i}]`;
      let childElement = await page.$x(childXPath);
      matchList.push(childElement[0]);
    }
    return matchList;
  }
  
  function ensureHttp(url, domain = "https://www.playhq.com") {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return domain + url;
    }
    return url;
  }
  
  module.exports = {
    getMatchList,
    ensureHttp
  };
  