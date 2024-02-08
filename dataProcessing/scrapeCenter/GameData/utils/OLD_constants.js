module.exports = {
    SELECTORS: {
      CHILDREN: "li[data-testid='games-on-date'] > div",
      ROUND: {
        General: "div[data-testid='fixture-list'] h3",
      },
      DATE: {
        General: "li[data-testid='games-on-date'] >div >span",
      },
      STATUS: {
        STATUS:
          `div >div div:nth-child(3) span`,
      },
      URL: {
        General: 'a[data-testid^="fixture-button-"]',
      },
      TEAMS: {
        General:
          ` > div > div:first-child a`,
      },
    },
  };
  