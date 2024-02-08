class CompetitionUtils {
  getLastItemInUrl(url) {
    const urlParts = url.split("/");
    let lastItem = urlParts[urlParts.length - 1];

    if (lastItem === "" && urlParts.length > 1) {
      lastItem = urlParts[urlParts.length - 2];
    }

    if (lastItem === "teams") {
      lastItem = urlParts[urlParts.length - 2];
    }

    return lastItem;
  }
}

module.exports = CompetitionUtils;
