/**
 * Test URLs for Hardcoded Entities
 * Direct URLs for scraping without CMS dependencies
 */

const testUrls = {
  // Lynbrook Cricket Club URLs
  lynbrookClub: {
    baseUrl: "https://www.playhq.com",
    paths: {
      main: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      competitions:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/competitions",
      teams:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/teams",
      fixtures:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/fixtures",
      ladder:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/ladder",
    },

    // Full URLs
    fullUrls: {
      main: "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      competitions:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/competitions",
      teams:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/teams",
      fixtures:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/fixtures",
      ladder:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/ladder",
    },
  },

  // Casey-Cardinia Cricket Association URLs (ID: 427)
  caseyCardiniaAssociation: {
    baseUrl: "https://www.playhq.com",
    paths: {
      main: "/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      clubs:
        "/cricket-australia/org/casey-cardinia-cricket-association/18570db1/clubs",
      competitions:
        "/cricket-australia/org/casey-cardinia-cricket-association/18570db1/competitions",
      ladders:
        "/cricket-australia/org/casey-cardinia-cricket-association/18570db1/ladders",
      fixtures:
        "/cricket-australia/org/casey-cardinia-cricket-association/18570db1/fixtures",
    },

    // Full URLs
    fullUrls: {
      main: "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      clubs:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/clubs",
      competitions:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/competitions",
      ladders:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/ladders",
      fixtures:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1/fixtures",
    },
  },

  // DDCA Senior Competition URLs
  ddcaSeniorCompetition: {
    baseUrl: "https://www.playhq.com",
    paths: {
      main: "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324",
      teams:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams",
      ladder:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/ladder",
      fixtures:
        "/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/fixtures",
    },

    // Full URLs
    fullUrls: {
      main: "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324",
      teams:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams",
      ladder:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/ladder",
      fixtures:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/fixtures",
    },
  },

  // URL Validation Rules
  validation: {
    // URL patterns
    patterns: {
      playhq: /^https:\/\/www\.playhq\.com\/cricket-australia\/org\//,
      club: /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/teams\//,
      association:
        /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/$/,
      competition:
        /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/[^\/]+\/$/,
    },

    // Required URL components
    requiredComponents: {
      base: "https://www.playhq.com",
      org: "cricket-australia/org",
      entity: "lynbrook-cricket-club|test-association",
      competition: "ddca-senior-competition-summer-202324",
    },

    // URL structure validation
    structure: {
      club: {
        pattern:
          /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/[^\/]+\/teams\/[^\/]+\/[^\/]+$/,
        requiredSegments: [
          "cricket-australia",
          "org",
          "club-name",
          "competition",
          "teams",
          "team-name",
          "team-id",
        ],
      },
      association: {
        pattern:
          /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/$/,
        requiredSegments: ["cricket-australia", "org", "association-name"],
      },
      competition: {
        pattern:
          /^https:\/\/www\.playhq\.com\/cricket-australia\/org\/[^\/]+\/[^\/]+\/$/,
        requiredSegments: [
          "cricket-australia",
          "org",
          "club-name",
          "competition-name",
        ],
      },
    },
  },

  // Test URL Scenarios
  scenarios: {
    // Valid URLs
    valid: {
      club: "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10",
      association:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/18570db1",
      competition:
        "https://www.playhq.com/cricket-australia/org/casey-cardinia-cricket-association/ccca-senior-competition-summer-202526/04518c8e",
    },

    // Invalid URLs (for error testing)
    invalid: {
      malformed: "https://www.playhq.com/invalid-path",
      missingSegments: "https://www.playhq.com/cricket-australia/org/",
      wrongDomain: "https://www.example.com/cricket-australia/org/test",
      httpInsteadOfHttps: "http://www.playhq.com/cricket-australia/org/test",
    },

    // Edge cases
    edgeCases: {
      withQueryParams:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10?tab=fixtures",
      withFragment:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10#ladder",
      withTrailingSlash:
        "https://www.playhq.com/cricket-australia/org/lynbrook-cricket-club/8b217653/ddca-senior-competition-summer-202324/teams/lynbrook/54d2bc10/",
    },
  },

  // URL Building Utilities
  utils: {
    // Build full URL from base and path
    buildUrl: (baseUrl, path) => {
      const cleanBase = baseUrl.replace(/\/$/, "");
      const cleanPath = path.replace(/^\//, "");
      return `${cleanBase}/${cleanPath}`;
    },

    // Extract entity ID from URL
    extractEntityId: (url) => {
      const matches = url.match(/\/([a-f0-9]+)$/);
      return matches ? matches[1] : null;
    },

    // Extract entity type from URL
    extractEntityType: (url) => {
      if (url.includes("/teams/")) return "team";
      if (url.includes("/competitions/")) return "competition";
      if (url.includes("/clubs/")) return "club";
      if (url.includes("/org/") && !url.includes("/teams/"))
        return "association";
      return "unknown";
    },

    // Validate URL structure
    validateUrl: (url, expectedType) => {
      const patterns = testUrls.validation.patterns;
      const structures = testUrls.validation.structure;

      if (!patterns.playhq.test(url)) {
        return { valid: false, error: "Invalid PlayHQ URL" };
      }

      if (expectedType && structures[expectedType]) {
        if (!structures[expectedType].pattern.test(url)) {
          return {
            valid: false,
            error: `Invalid ${expectedType} URL structure`,
          };
        }
      }

      return { valid: true };
    },
  },
};

module.exports = testUrls;
