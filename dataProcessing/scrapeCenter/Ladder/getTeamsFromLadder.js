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

    // Use singleton to share browser instance across services (memory optimization)
    this.puppeteerManager = PuppeteerManager.getInstance();
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

  async processTeamsBatch(grades) {
    if (!grades || grades.length === 0) {
      return [];
    }

    const { PARALLEL_CONFIG } = require("../../puppeteer/constants");
    const { processInParallel } = require("../../utils/parallelUtils");
    const concurrency = PARALLEL_CONFIG.TEAMS_CONCURRENCY;

    // CRITICAL: Create page pool BEFORE parallel processing starts
    if (this.puppeteerManager.pagePool.length === 0) {
      logger.info(
        `Creating page pool of size ${concurrency} before parallel processing`
      );
      await this.puppeteerManager.createPagePool(concurrency);
    }

    // Process grades in parallel
    const { results, errors } = await processInParallel(
      grades,
      async (GradeInfo, index) => {
        const taskStartTime = Date.now();
        // Get a page from the pool
        const page = await this.puppeteerManager.getPageFromPool();
        const pageAcquiredTime = Date.now();

        try {
          const fetcherInfo = {
            href: GradeInfo.url,
            compID: GradeInfo.compID,
            id: GradeInfo.id,
          };

          logger.info(
            `[PARALLEL_TEAMS] [TASK-${index + 1}] START grade: ${GradeInfo.name || GradeInfo.id} (page acquired: ${pageAcquiredTime - taskStartTime}ms)`
          );

          const teamData = await this.fetchTeamData(page, fetcherInfo);
          const taskDuration = Date.now() - taskStartTime;
          logger.info(
            `[PARALLEL_TEAMS] [TASK-${index + 1}] COMPLETE grade: ${GradeInfo.name || GradeInfo.id} (duration: ${taskDuration}ms, teams: ${teamData?.length || 0})`
          );
          return teamData;
        } catch (error) {
          logger.error(
            `Error processing grade ${GradeInfo.id}: ${error.message}`,
            { error, gradeId: GradeInfo.id }
          );
          throw error;
        } finally {
          // Release page back to pool
          await this.puppeteerManager.releasePageFromPool(page);
        }
      },
      concurrency,
      {
        context: "teams_ladder",
        logProgress: true,
        continueOnError: true,
      }
    );

    // Flatten results
    return results.flat();
  }

  async setup() {
    try {
      // Process grades in parallel using page pool
      let teams = await this.processTeamsBatch(this.GRADES);
      teams = this.removeDuplicateTeams(teams);

      if (teams.length === 0) {
        logger.warn(`No teams found`);
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
      console.error(error);
      throw error;
    }
  }

  findCompIDForTeam(teamInfo) {
    const gradeInfo = this.GRADES.find((grade) => grade.id === teamInfo.grade);
    return gradeInfo ? gradeInfo.compID : null;
  }

  removeDuplicateTeams(teams) {
    const uniqueTeams = [];

    teams.forEach((team) => {
      if (!this.isDuplicateTeam(team, uniqueTeams)) {
        uniqueTeams.push(team);
      }
    });

    return uniqueTeams;
  }

  isDuplicateTeam(team, teamList) {
    return teamList.some(
      (existingTeam) =>
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
