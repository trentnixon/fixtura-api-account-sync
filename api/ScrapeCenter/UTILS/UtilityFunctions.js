async function countLiElements(page, xpath) {
  await page.waitForSelector(`xpath/${xpath}`);
  const liElements = await page.$$(`xpath/${xpath}`);
  return liElements.length;
}

async function getMatchList(page, xpath) {
  await page.waitForSelector(`xpath/${xpath}`);
  const numLiElements = await countLiElements(page, xpath);
  let matchList = [];

  for (let liIndex = 1; liIndex <= numLiElements; liIndex++) {
    let currentLiXPath = `${xpath}[${liIndex}]`;
    const childDivs = await page.$$(`xpath/${currentLiXPath}/div`);
    // Skip the first <div> and process the rest
    for (let divIndex = 1; divIndex < childDivs.length; divIndex++) {
      matchList.push(childDivs[divIndex]);
    }
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
  ensureHttp,
};
