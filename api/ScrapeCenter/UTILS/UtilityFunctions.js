
async function countLiElements(page, xpath) {
  await page.waitForXPath(xpath);
  const liElements = await page.$x(xpath);
  return liElements.length;
}


async function getMatchList(page, xpath) {
  await page.waitForXPath(xpath);
  const numLiElements = await countLiElements(page, xpath);
  let matchList = [];

  for (let liIndex = 1; liIndex <= numLiElements; liIndex++) {
    let currentLiXPath = `${xpath}[${liIndex}]`;
    const childDivs = await page.$x(`${currentLiXPath}/div`);
    // Skip the first <div> and process the rest
    for (let divIndex = 1; divIndex < childDivs.length; divIndex++) {
      matchList.push(childDivs[divIndex]);
    }
  }

  return matchList;
}

/*
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
*/
  
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
  