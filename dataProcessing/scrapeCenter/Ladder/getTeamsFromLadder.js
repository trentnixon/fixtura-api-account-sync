const logger = require("../../../src/utils/logger");
const TeamFetcher = require("./TeamFetcher");
const CRUDOperations = require("../../services/CRUDoperations");
const ProcessingTracker = require("../../services/processingTracker");
const PuppeteerManager = require("../../puppeteer/PuppeteerManager");

/**
 * The GetTeams class handles scraping of team data from websites.
 * Supports different modes for clubs and associations and includes duplicate removal logic.
 */
class GetTeams {
  constructor(OBJ) {
    this.OBJ = OBJ;
    this.AccountID = OBJ.ACCOUNT.ACCOUNTID;
    this.ACCOUNTTYPE = OBJ.ACCOUNT.ACCOUNTTYPE;
    this.GRADES = OBJ.Grades;
    this.URLs = OBJ.TEAMS;

    this.puppeteerManager = new PuppeteerManager();
    this.CRUDOperations = new CRUDOperations();
    this.processingTracker = ProcessingTracker.getInstance();
    this.domain = "https://www.playhq.com";
  }

  async initPage() {
    return await this.puppeteerManager.createPageInNewContext();
  }

  async fetchTeamData(page, fetcherInfo) {
    const teamFetcher = new TeamFetcher(page, fetcherInfo);
    return teamFetcher.fetchTeams();
  }

  async processTeams(page) {
    let teams = [];

    for (const GradeInfo of this.GRADES) {
      try {
        const fetcherInfo = {
          href: GradeInfo.url,
          compID: GradeInfo.compID,
          id: GradeInfo.id,
        };

        const teamData = await this.fetchTeamData(page, fetcherInfo);

        teams = [...teams, ...teamData];
      } catch (error) {
        logger.error(
          `Error in GetTeams processTeams method: ${GradeInfo.href}`,
          { error, method: "processTeams", class: "GetTeams" }
        );
      }
    }
    return this.removeDuplicateTeams(teams);
  }

  async setup() {
    try {
      const page = await this.initPage();
      const teams = await this.processTeams(page);

      if (teams.length === 0) {
        logger.warn(`No teams found`);
        //throw new Error("No teams found");
        return false;
      }

      this.processingTracker.itemFound("teams", teams.length);
      return teams;
    } catch (error) {
      logger.error("Error in GetTeams setup method", {
        error,
        method: "setup",
        class: "GetTeams",
      });
      throw error;
    } finally {
      await this.puppeteerManager.dispose();
    }
  }

  findCompIDForTeam(teamInfo) {
    const gradeInfo = this.GRADES.find(grade => grade.id === teamInfo.grade);
    return gradeInfo ? gradeInfo.compID : null;
  }

  removeDuplicateTeams(teams) {
    const uniqueTeams = [];

    teams.forEach(team => {
      if (!this.isDuplicateTeam(team, uniqueTeams)) {
        uniqueTeams.push(team);
      }
    });

    return uniqueTeams;
  }

  isDuplicateTeam(team, teamList) {
    return teamList.some(
      existingTeam =>
        existingTeam.teamID === team.teamID &&
        existingTeam.competition.toString() === team.competition.toString() &&
        existingTeam.grades.toString() === team.grades.toString()
    );
  }
}

module.exports = GetTeams;

/**
 * Developer Notes:
 * - Ensure the input object (OBJ) passed to GetTeams is structured correctly.
 * - This class relies on TeamFetcher for the actual scraping logic.
 * - Duplicate team removal is based on teamID, competition, and grades matching.
 *
 * Future Improvements:
 * - Consider adding more robust error handling for different steps in the processTeams method.
 * - Explore performance optimization for the scraping process.
 * - Investigate additional data validations or cleaning steps before processing teams.
 * - Consider adding logging or tracking for duplicate teams found and removed.
 */
