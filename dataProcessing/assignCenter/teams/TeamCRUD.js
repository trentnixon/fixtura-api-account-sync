const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");

/**
 * Provides Create, Read, Update, Delete (CRUD) operations for team data.
 */
class TeamCRUD {
    constructor(dataObj) {
        this.dataObj = dataObj;
    }

    // Checks if a team exists in the database
    async checkIfTeamExists(teamID, resourcePath) {
        try {
            const response = await fetcher(`${resourcePath}?filters[teamID][$eq]=${teamID}`);
            return response.length > 0 ? response : null;
        } catch (error) {
            logger.error(`Error in TeamCRUD checkIfTeamExists method: ${error}`, {
                method: "checkIfTeamExists", class: "TeamCRUD"
            });
            throw new Error(`Error in TeamCRUD checkIfTeamExists method: ${error}`);
        }
    }

    // Creates a new team entry in the database
    async createTeam(team) {
        try {
            const response = await fetcher('teams', 'POST', { data: team });
            logger.info(`Team created with ID: ${response.id}`, {
                method: "createTeam", class: "TeamCRUD"
            });
            return response;
        } catch (error) {
            logger.error(`Error in TeamCRUD createTeam method: ${error}`, {
                method: "createTeam", class: "TeamCRUD"
            });
            throw new Error(`Error in TeamCRUD createTeam method: ${error}`);
        }
    }

    // Updates an existing team in the database
    async updateTeam(teamId, team) {
        try {
            await fetcher(`teams/${teamId}`, 'PUT', { data: team });
            logger.info(`Team updated with ID: ${teamId}`, {
                method: "updateTeam", class: "TeamCRUD"
            });
        } catch (error) {
            logger.error(`Error in TeamCRUD updateTeam method: ${error}`, {
                method: "updateTeam", class: "TeamCRUD"
            });
            throw new Error(`Error in TeamCRUD updateTeam method: ${error}`);
        }
    }

    // Additional CRUD operations can be added here
}

module.exports = TeamCRUD;

/**
 * Developer Notes:
 * - This class handles the database operations for team data.
 * - It requires a data object to be passed during initialization.
 * - Detailed logging is provided for each CRUD operation.
 *
 * Future Improvements:
 * - Consider implementing transactional operations for rollback on errors.
 * - Explore opportunities to optimize database queries.
 * - Add more detailed logging and error reporting for debugging.
 * - Look into implementing more robust validation for team data.
 */
