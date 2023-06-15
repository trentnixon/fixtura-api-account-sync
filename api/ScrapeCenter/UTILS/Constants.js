module.exports = {
    //...other constants
    SELECTORS: {
        ROUND: {
          General: "div[data-testid='fixture-list'] h3",
        },
        DATE: {
          General: "li[data-testid='games-on-date'] >div >span",
        },
        TYPE: {
          TYPE: "li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(1)",
        },
        TIME: {
          General:
            "li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(2) > div:nth-child(2) > span",
        },
        GROUNDS: {
          General:
            "li[data-testid='games-on-date'] > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(3) span",
        },
        STATUS: {
          STATUS:
            "li[data-testid='games-on-date'] >div:nth-child(2) div >div div:nth-child(3) span",
        },
        URL: {
          General: 'a[data-testid^="fixture-button-"]',
        },
        TEAMS: {
          General:
            "li[data-testid='games-on-date'] > div:nth-child(2) > div > div:first-child a",
        },
      },
  };
  