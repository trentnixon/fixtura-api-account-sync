const fetcher = require("../../../src/utils/fetcher");
const logger = require("../../../src/utils/logger");
const qs = require("qs");

class CompetitionCRUD {
  constructor(dataObj) {
    this.dataObj = dataObj;
  }
  /**************************************************** */
  // GET
  /**************************************************** */
  async checkIfCompetitionExists(competitionId, resourcePath) {
    const query = qs.stringify(
      {
        filters: {
          competitionId: { $eq: competitionId },
        },
      },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`${resourcePath}?${query}`);
      // Handle null/undefined response gracefully
      if (!response || !Array.isArray(response)) {
        logger.warn(`checkIfCompetitionExists: Invalid response format`, {
          response,
          competitionId,
          resourcePath,
        });
        return false;
      }
      return response.length > 0 ? response : false;
    } catch (error) {
      logger.error(`Error in checkIfCompetitionExists`, {
        competitionId,
        resourcePath,
        error: error.message,
      });
      throw new Error(`Error in checkIfCompetitionExists: ${error.message}`);
    }
  }

  async checkIfClubToCompIsAlreadyStored(competition) {
    const query = qs.stringify(
      {
        filters: {
          competitionUrl: { $eq: competition.url },
          club: { id: { $eq: competition.club } },
          competition: { id: { $eq: competition.competition } },
        },
      },
      { encodeValuesOnly: true }
    );

    try {
      const response = await fetcher(`club-to-competitions?${query}`);
      return response.length !== 0;
    } catch (error) {
      throw new Error(`Error in checkIfClubToCompIsAlreadyStored: ${error}`);
    }
  }

  async checkIfAssociationToCompIsAlreadyStored(competitionId, associationId) {
    // Associations have a direct oneToMany relation with competitions (no link table needed)
    // Check if the competition already has this association linked by querying the competition directly
    try {
      const competition = await fetcher(`competitions/${competitionId}?populate=association`);


      // Check if competition has association relation and if it matches our associationId
      // Handle both possible response structures: data array or direct array
      let associations = [];
      try {
        if (competition?.attributes?.association?.data) {
          associations = Array.isArray(competition.attributes.association.data)
            ? competition.attributes.association.data
            : [];
        } else if (Array.isArray(competition?.attributes?.association)) {
          associations = competition.attributes.association;
        } else if (competition?.association?.data) {
          associations = Array.isArray(competition.association.data)
            ? competition.association.data
            : [];
        } else if (Array.isArray(competition?.association)) {
          associations = competition.association;
        } else if (competition?.attributes?.association === null || competition?.attributes?.association === undefined) {
          // No association relation set - this is valid, just empty array
          associations = [];
        }
      } catch (parseError) {
        logger.error(`[checkIfAssociationToCompIsAlreadyStored] Error parsing associations array`, {
          competitionId,
          associationId,
          parseError: parseError.message,
          parseErrorStack: parseError.stack,
        });
        associations = [];
      }

      // Safely check if linked
      const isLinked = Array.isArray(associations) && associations.some(assoc => {
        try {
          const assocId = assoc?.id || assoc;
          return assocId === associationId;
        } catch (compareError) {
          logger.warn(`[checkIfAssociationToCompIsAlreadyStored] Error comparing association`, {
            assoc,
            associationId,
            compareError: compareError.message,
          });
          return false;
        }
      });

      // Safely map associations for logging
      let existingAssociationIds = [];
      try {
        existingAssociationIds = Array.isArray(associations)
          ? associations.map(a => a?.id || a).filter(id => id !== undefined && id !== null)
          : [];
      } catch (mapError) {
        logger.warn(`[checkIfAssociationToCompIsAlreadyStored] Error mapping associations for logging`, {
          mapError: mapError.message,
        });
      }

      logger.debug(`checkIfAssociationToCompIsAlreadyStored: Competition ${competitionId} linked to association ${associationId}: ${isLinked}`);

      return isLinked;
    } catch (error) {
      logger.error(`checkIfAssociationToCompIsAlreadyStored: Error checking association link`, {
        competitionId,
        associationId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      return false; // Assume not linked if we can't check
    }
  }

  /**************************************************** */
  // PUT
  /**************************************************** */
  async updateClubCompetition(competition, existingCompetitionId) {
    try {
      // Update the competition in the database
      await fetcher(`competitions/${existingCompetitionId}`, "PUT", {
        data: competition,
      });
      logger.info(
        `Competition updated for club: ${competition.competitionName}`
      );

      // Step 2 & 3: Check and create a link in club-to-competitions if not exists
      const isLinked = await this.checkIfClubToCompIsAlreadyStored({
        competitionUrl: competition.url,
        club: [this.dataObj.TYPEOBJ.TYPEID],
        competition: [existingCompetitionId],
      });

      if (!isLinked) {
        // If not linked, create a new club-to-competition link
        await this.createClubToCompetitionLink({
          competitionUrl: competition.url,
          club: [this.dataObj.TYPEOBJ.TYPEID],
          competition: [existingCompetitionId],
        });
      }
    } catch (error) {
      throw new Error(`Error updating competition for club: ${error}`);
    }
  }

  async updateAssociationCompetition(competition, existingCompetitionId) {
    // OCT 2024: removed if linked check
    // not sure why it was here, but it was causing an error when comp names were in correct
    // reinstating so each pass over a comp gets the latest version

    // Check if the association is already linked to the competition
    /* const isLinked = await this.checkIfAssociationToCompIsAlreadyStored(
      existingCompetitionId,
      this.dataObj.TYPEOBJ.TYPEID
    ); */
    //if (!isLinked) {
    try {
      // DEBUG: Log the incoming competition object to see what fields it contains
      logger.info(`[CompetitionCRUD] updateAssociationCompetition - DEBUG START`, {
        competitionId: existingCompetitionId,
        competitionName: competition.competitionName,
        competitionObjectKeys: Object.keys(competition),
        competitionObject: JSON.stringify(competition, null, 2),
        dataObjTYPEOBJ: this.dataObj.TYPEOBJ,
        dataObjACCOUNT: this.dataObj.ACCOUNT,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
        typeObjTypeId: this.dataObj.TYPEOBJ?.TYPEID,
      });

      // Create a clean update object with competition fields only
      // NOTE: We do NOT set the association field here - it will be handled separately
      // after the update to preserve existing associations and add this one if needed
      const updateData = {
        competitionName: competition.competitionName,
        competitionUrl: competition.url || competition.competitionUrl,
        orgName: competition.orgName,
        status: competition.status,
        season: competition.season,
        startDate: competition.startDate,
        endDate: competition.endDate,
        // Do NOT include association field here - it will be handled separately below
      };


      await fetcher(`competitions/${existingCompetitionId}`, "PUT", {
        data: updateData,
      });
      logger.info(
        `Competition updated for association: ${competition.competitionName}`
      );

      // Step 2 & 3: Check and link association directly to competition if not already linked
      // Associations have a direct oneToMany relation with competitions (no link table needed)
      const isLinked = await this.checkIfAssociationToCompIsAlreadyStored(
        existingCompetitionId,
        this.dataObj.TYPEOBJ.TYPEID
      );

      if (!isLinked) {
        // If not linked, update the competition to include this association in its association field
        // Get existing associations first to preserve them
        let updatedAssociationIds = null;
        try {
          const existingCompetition = await fetcher(`competitions/${existingCompetitionId}?populate=association`);


          // Handle both possible response structures: data array or direct array
          let existingAssociations = [];
          try {
            if (existingCompetition?.attributes?.association?.data) {
              existingAssociations = Array.isArray(existingCompetition.attributes.association.data)
                ? existingCompetition.attributes.association.data
                : [];
            } else if (Array.isArray(existingCompetition?.attributes?.association)) {
              existingAssociations = existingCompetition.attributes.association;
            } else if (existingCompetition?.association?.data) {
              existingAssociations = Array.isArray(existingCompetition.association.data)
                ? existingCompetition.association.data
                : [];
            } else if (Array.isArray(existingCompetition?.association)) {
              existingAssociations = existingCompetition.association;
            } else if (existingCompetition?.attributes?.association === null || existingCompetition?.attributes?.association === undefined) {
              // No association relation set - this is valid, just empty array
              existingAssociations = [];
            }
          } catch (parseError) {
            logger.error(`[updateAssociationCompetition] Error parsing existingAssociations array`, {
              competitionId: existingCompetitionId,
              parseError: parseError.message,
              parseErrorStack: parseError.stack,
            });
            existingAssociations = [];
          }

          // Safely map associations to IDs
          let existingAssociationIds = [];
          try {
            existingAssociationIds = Array.isArray(existingAssociations)
              ? existingAssociations.map(a => a?.id || a).filter(id => id !== undefined && id !== null)
              : [];
          } catch (mapError) {
            logger.error(`[updateAssociationCompetition] Error mapping existingAssociations for IDs`, {
              mapError: mapError.message,
              mapErrorStack: mapError.stack,
            });
            existingAssociationIds = [];
          }

          // Add our association ID if not already present
          if (!existingAssociationIds.includes(this.dataObj.TYPEOBJ.TYPEID)) {
            updatedAssociationIds = [...existingAssociationIds, this.dataObj.TYPEOBJ.TYPEID];

            logger.info(`Linking association ${this.dataObj.TYPEOBJ.TYPEID} to competition ${existingCompetitionId}`, {
              competitionId: existingCompetitionId,
              associationId: this.dataObj.TYPEOBJ.TYPEID,
              existingAssociations: existingAssociationIds,
              updatedAssociations: updatedAssociationIds,
            });

            // Update competition with association relation
            // Strapi expects an array of IDs for relation updates
            await fetcher(`competitions/${existingCompetitionId}`, "PUT", {
              data: {
                association: updatedAssociationIds,
              },
            });

            logger.info(`Association ${this.dataObj.TYPEOBJ.TYPEID} linked to competition ${existingCompetitionId}`);
          } else {
            logger.debug(`Association ${this.dataObj.TYPEOBJ.TYPEID} already linked to competition ${existingCompetitionId}`);
          }
        } catch (linkError) {
          logger.error(`Error linking association to competition`, {
            competitionId: existingCompetitionId,
            associationId: this.dataObj.TYPEOBJ.TYPEID,
            errorMessage: linkError.message,
            errorStack: linkError.stack,
          });
          // Don't throw - competition update succeeded, link is optional
        }
      } else {
        logger.debug(`Association ${this.dataObj.TYPEOBJ.TYPEID} already linked to competition ${existingCompetitionId}`);
      }
    } catch (error) {
      // DEBUG: Enhanced error logging
      logger.error(`[CompetitionCRUD] updateAssociationCompetition - ERROR`, {
        competitionId: existingCompetitionId,
        competitionName: competition.competitionName,
        errorMessage: error.message,
        errorStack: error.stack,
        competitionObject: JSON.stringify(competition, null, 2),
        dataObjTYPEOBJ: this.dataObj.TYPEOBJ,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
      });
      throw new Error(`Error updating competition for association: ${error}`);
    }
    //}
    /*  else {
      logger.info(
        `Competition already linked to association: ${competition.competitionName}`
      );
    } */
  }

  /**************************************************** */
  // POST
  /**************************************************** */
  async createCompetitionEntry(competition) {
    try {

      // Create a clean competition object without the association field
      // The competition object may have an invalid association ID from the scraper
      // We should NOT send association field when creating - use association-to-competitions link instead
      const newCompetitionData = {
        competitionName: competition.competitionName,
        competitionUrl: competition.url || competition.competitionUrl,
        orgName: competition.orgName,
        status: competition.status,
        season: competition.season,
        startDate: competition.startDate,
        endDate: competition.endDate,
        // Explicitly DO NOT include association field - use association-to-competitions link table instead
      };


      const response = await fetcher("competitions", "POST", {
        data: newCompetitionData,
      });
      return response.id;
    } catch (error) {
      // DEBUG: Enhanced error logging
      logger.error(`[CompetitionCRUD] createCompetitionEntry - ERROR`, {
        competitionName: competition.competitionName,
        errorMessage: error.message,
        errorStack: error.stack,
        competitionObject: JSON.stringify(competition, null, 2),
        dataObjTYPEOBJ: this.dataObj.TYPEOBJ,
        accountType: this.dataObj.ACCOUNT.ACCOUNTTYPE,
      });
      throw new Error(`Error creating new competition: ${error}`);
    }
  }

  async createClubToCompetitionLink(competitionData) {
    try {
      await fetcher("club-to-competitions", "POST", { data: competitionData });
      logger.info(
        `Club to competition link created for competition: ${competitionData.competition}`
      );
    } catch (error) {
      throw new Error(`Error creating club to competition link: ${error}`);
    }
  }

  async createAssociationToCompetitionLink(competitionData) {
    try {
      await fetcher("association-to-competitions", "POST", {
        data: competitionData,
      });
      logger.info(
        `Association to competition link created for competition: ${competitionData.competition}`
      );
    } catch (error) {
      throw new Error(
        `Error creating association to competition link: ${error}`
      );
    }
  }
}

module.exports = CompetitionCRUD;
