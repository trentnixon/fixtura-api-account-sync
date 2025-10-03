/**
 * Hardcoded Test Entities
 * Predefined club and association data for testing without CMS dependencies
 */

const hardcodedTestEntities = {
  // Test Club Entity
  club: {
    id: 9271,
    name: "Lynbrook Cricket Club",
    href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
    grade: 5706,
    type: "club",
    status: "active",

    // Direct URLs for scraping
    urls: {
      main: "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      competitions:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/competitions",
      teams:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/teams",
      fixtures:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/fixtures",
    },

    // Expected scraped data structure
    expectedData: {
      competitions: [
        {
          id: 5706,
          name: "DDCA Senior Competition",
          href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324",
          grade: 5706,
          type: "competition",
          season: "Summer 2023/24",
        },
      ],
      teams: [
        {
          id: "54d2bc10",
          name: "Lynbrook",
          href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
          grade: 5706,
          position: 1,
          statistics: {
            played: 8,
            won: 6,
            lost: 2,
            points: 24,
          },
        },
      ],
      games: [
        {
          id: "game-001",
          date: "Saturday, 14 October 2023",
          round: "Round 1",
          status: "Final",
          teams: [
            { name: "Lynbrook", score: "8/150" },
            { name: "Opponent Team", score: "7/148" },
          ],
          urlToScoreCard: "/scorecard/12345",
          gameID: "12345",
        },
      ],
    },

    // Validation rules
    validation: {
      requiredFields: ["id", "name", "href", "grade"],
      urlPattern: /^\/cricket-australia\/org\/lynbrook-cricket-club/,
      gradeRange: [5000, 6000],
      expectedCompetitionCount: 1,
      expectedTeamCount: 1,
    },
  },

  // Test Association Entity (Casey-Cardinia)
  associationCaseyCa: {
    id: 427,
    name: "Casey-Cardinia Cricket Association",
    href: "/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
    type: "association",
    status: "active",

    // Direct URLs for scraping
    urls: {
      main: "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      clubs:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/clubs",
      competitions:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/competitions",
      ladders:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/ladders",
    },

    // Expected scraped data structure
    expectedData: {
      clubs: [
        {
          id: 9271,
          name: "Lynbrook Cricket Club",
          href: "/cricket-australia/org/lynbrook-cricket-club/8b217653",
          type: "club",
          status: "active",
        },
        {
          id: 9272,
          name: "Test Cricket Club",
          href: "/cricket-australia/org/test-cricket-club/8b217654",
          type: "club",
          status: "active",
        },
      ],
      competitions: [
        {
          competitionId: "a8c2210f",
          competitionName: "CCCA Junior Competition",
          season: "Summer 2025/26",
          startDate: "03 Oct 2025",
          endDate: "31 Mar 2026",
          status: "Upcoming",
          url: "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/ccca-junior-competition-summer-202526/a8c2210f",
          association: 427,
        },
        {
          competitionId: "b6eb6172",
          competitionName: "CCCA Kookaburra Cup",
          season: "Summer 2025/26",
          startDate: "03 Oct 2025",
          endDate: "03 Oct 2025",
          status: "Upcoming",
          url: "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/ccca-kookaburra-cup-summer-202526/b6eb6172",
          association: 427,
        },
        {
          competitionId: "04518c8e",
          competitionName: "CCCA Senior Competition",
          season: "Summer 2025/26",
          startDate: "04 Oct 2025",
          endDate: "31 Mar 2026",
          status: "Upcoming",
          url: "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/ccca-senior-competition-summer-202526/04518c8e",
          association: 427,
        },
      ],
      ladders: [
        {
          position: 1,
          teamName: "Lynbrook",
          teamHref:
            "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
          PLAYED: 8,
          PTS: 24,
          netRunRate: 0.5,
          W: 6,
          L: 2,
          D: 0,
          NR: 0,
          BYE: 0,
        },
        {
          position: 2,
          teamName: "Test Team",
          teamHref:
            "/cricket-australia/org/test-cricket-club/8b217654/ddca-senior-competition-summer-202324/teams/test-team/54d2bc11",
          PLAYED: 8,
          PTS: 20,
          netRunRate: 0.3,
          W: 5,
          L: 3,
          D: 0,
          NR: 0,
          BYE: 0,
        },
      ],
    },

    // Validation rules
    validation: {
      requiredFields: [
        "competitionId",
        "competitionName",
        "season",
        "url",
        "association",
      ],
      urlPattern:
        /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/casey-cardinia-cricket-association/,
      expectedClubCount: 2,
      expectedCompetitionCount: 3, // Updated to match actual scraped data
      expectedLadderCount: 2,
    },
  },

  // Test Association Entity (Dandenong District)
  associationDandenong: {
    id: 0, // Will be updated after first scrape
    name: "Dandenong District Cricket Association",
    href: "/cricket-australia/org/dandenong-district-cricket-association/34c8d195",
    type: "association",
    status: "active",

    // Direct URLs for scraping
    urls: {
      main: "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/34c8d195",
      clubs:
        "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/34c8d195/clubs",
      competitions:
        "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/34c8d195/competitions",
      ladders:
        "https://www.playhq.com/cricket-australia/org/dandenong-district-cricket-association/34c8d195/ladders",
    },

    // Expected scraped data structure (will be populated after first scrape)
    expectedData: {
      clubs: [],
      competitions: [], // To be filled after scraping
      ladders: [],
    },

    // Validation rules
    validation: {
      requiredFields: [
        "competitionId",
        "competitionName",
        "season",
        "url",
        "association",
      ],
      urlPattern:
        /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/dandenong-district-cricket-association/,
      expectedClubCount: 0,
      expectedCompetitionCount: 0, // Will be updated after first scrape
      expectedLadderCount: 0,
    },
  },

  // Test Data Objects for Scrapers
  testDataObjects: {
    // Club data object for club scrapers
    clubDataObj: {
      ACCOUNT: {
        ACCOUNTID: 9271,
        ACCOUNTNAME: "Lynbrook Cricket Club",
        ACCOUNTTYPE: "club",
        ACCOUNTHREF:
          "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      },
      TYPEOBJ: {
        TYPE: "club",
        ID: 9271,
        HREF: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      },
      TEAMS: [
        {
          teamName: "Lynbrook",
          id: "54d2bc10",
          href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
          grade: 5706,
        },
      ],
    },

    // Association data object for association scrapers
    associationDataObj: {
      ACCOUNT: {
        ACCOUNTID: 427,
        ACCOUNTNAME: "Casey-Cardinia Cricket Association",
        ACCOUNTTYPE: "association",
        ACCOUNTHREF:
          "/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      },
      TYPEOBJ: {
        TYPE: "association",
        TYPEID: 427,
        TYPEURL:
          "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      },
      CLUBS: [
        {
          id: 9271,
          name: "Lynbrook Cricket Club",
          href: "/cricket-australia/org/lynbrook-cricket-club/8b217653",
        },
        {
          id: 9272,
          name: "Test Cricket Club",
          href: "/cricket-australia/org/test-cricket-club/8b217654",
        },
      ],
    },
  },

  // Mock CMS Responses (for testing without real CMS)
  mockCMSResponses: {
    // Mock club data from CMS
    clubFromCMS: {
      id: 9271,
      attributes: {
        name: "Lynbrook Cricket Club",
        href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
        type: "club",
        status: "active",
        competitions: {
          data: [
            {
              id: 5706,
              attributes: {
                name: "DDCA Senior Competition",
                href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324",
                grade: 5706,
              },
            },
          ],
        },
        teams: {
          data: [
            {
              id: "54d2bc10",
              attributes: {
                name: "Lynbrook",
                href: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
                grade: 5706,
              },
            },
          ],
        },
      },
    },

    // Mock association data from CMS
    associationFromCMS: {
      id: 427,
      attributes: {
        name: "Test Association",
        href: "/cricket-australia/org/test-association/123456",
        type: "association",
        status: "active",
        clubs: {
          data: [
            {
              id: 9271,
              attributes: {
                name: "Lynbrook Cricket Club",
                href: "/cricket-australia/org/lynbrook-cricket-club/8b217653",
              },
            },
            {
              id: 9272,
              attributes: {
                name: "Test Cricket Club",
                href: "/cricket-australia/org/test-cricket-club/8b217654",
              },
            },
          ],
        },
        competitions: {
          data: [
            {
              id: 5706,
              attributes: {
                name: "DDCA Senior Competition",
                href: "/cricket-australia/org/test-association/123456/ddca-senior-competition-summer-202324",
                grade: 5706,
              },
            },
            {
              id: 5707,
              attributes: {
                name: "DDCA Junior Competition",
                href: "/cricket-australia/org/test-association/123456/ddca-junior-competition-summer-202324",
                grade: 5707,
              },
            },
          ],
        },
      },
    },
  },

  // Test Scenarios
  testScenarios: {
    // Success scenarios
    success: {
      club: {
        description: "Successful club data scraping",
        expectedResult: "Complete club data with competitions and teams",
        validationPoints: [
          "data completeness",
          "URL accuracy",
          "data structure",
        ],
      },
      association: {
        description: "Successful association data scraping",
        expectedResult: "Complete association data with clubs and competitions",
        validationPoints: [
          "data completeness",
          "URL accuracy",
          "data structure",
        ],
      },
    },

    // Error scenarios
    error: {
      networkError: {
        description: "Network error during scraping",
        expectedResult: "Graceful error handling with retry",
        validationPoints: [
          "error logging",
          "retry mechanism",
          "fallback strategy",
        ],
      },
      dataNotFound: {
        description: "Expected data not found on page",
        expectedResult: "Partial data extraction with error reporting",
        validationPoints: [
          "partial data handling",
          "error reporting",
          "data validation",
        ],
      },
      pageStructureChanged: {
        description: "Website structure changed",
        expectedResult: "Adaptive scraping with fallback selectors",
        validationPoints: [
          "selector fallback",
          "error detection",
          "adaptive scraping",
        ],
      },
    },

    // Performance scenarios
    performance: {
      largeDataset: {
        description: "Scraping large dataset",
        expectedResult: "Efficient processing within time limits",
        validationPoints: ["processing time", "memory usage", "data accuracy"],
      },
      concurrentScraping: {
        description: "Multiple scrapers running concurrently",
        expectedResult: "No resource conflicts or data corruption",
        validationPoints: [
          "resource management",
          "data integrity",
          "concurrent processing",
        ],
      },
    },
  },
};

module.exports = hardcodedTestEntities;
