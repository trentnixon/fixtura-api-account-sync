class ScrapeUtils {
  async findItem(matchElement, selector) {
    try {
      const item = await matchElement.$eval(selector, (el) =>
        el.textContent.trim()
      );
      return item;
    } catch (error) {
      return false;
    }
  }

  async scrapeRound(matchElement, selector) {
    return await this.findItem(matchElement, selector);
  }

  async scrapeDate(matchElement, selector) {
    return await this.findItem(matchElement, selector);
  }

  async scrapeGameURL(matchElement, selector) {
    try {
      const url = await matchElement.$eval(selector, (el) =>
        el.getAttribute("href")
      );
      return url;
    } catch (error) {
      return false;
    }
  }

  async scrapeTeams(matchElement, selector) {
    const teams = await matchElement.$$eval(selector, (anchors) => {
      return anchors.map((a) => {
        const name = a.textContent.trim();
        const url = a.getAttribute("href");
        const id = url.split("/").pop();
        return { name, id };
      });
    });
    return teams;
  }

  async scrapeTime(matchElement, selectors) {
    const timeSelector = await this.findItem(matchElement, selectors.General);
    const timeCancelledSelector = await this.findItem(
      matchElement,
      selectors.Cancelled
    );

    if (timeCancelledSelector) {
      return timeSelector ? timeSelector : "";
    } else if (timeSelector) {
      return timeSelector ? timeSelector : "";
    }
  }

  async scrapeType(matchElement, selectors) {
    const typeSelector = await this.findItem(matchElement, selectors.Abandoned);
    const typeCancelledSelector = await this.findItem(
      matchElement,
      selectors.Cancelled
    );
    const typeRegular = await this.findItem(matchElement, selectors.General);

    if (typeSelector) {
      return typeSelector;
    } else if (typeCancelledSelector) {
      return typeCancelledSelector;
    } else {
      return typeRegular;
    }
  }

  async scrapeGround(matchElement, selectors) {
    const groundSelector = await this.findItem(matchElement, selectors.General);
    const groundCancelledSelector = await this.findItem(
      matchElement,
      selectors.Cancelled
    );

    if (groundCancelledSelector) {
      return groundCancelledSelector;
    } else if (groundSelector) {
      return groundSelector;
    }
  }

  async scrapeStatus(matchElement, selectors) {
    const statusAbandonedSelector = await this.findItem(
      matchElement,
      selectors.Abandoned
    );
    const statusPendingSelector = await this.findItem(
      matchElement,
      selectors.Pending
    );
    const statusFinalSelector = await this.findItem(
      matchElement,
      selectors.Final
    );

    if (statusAbandonedSelector) {
      return statusAbandonedSelector;
    } else if (statusPendingSelector) {
      return statusPendingSelector;
    } else if (statusFinalSelector) {
      return statusFinalSelector;
    }
  }
}

module.exports = ScrapeUtils;
