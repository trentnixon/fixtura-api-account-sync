const fetcher = require("../../Utils/fetcher");
const logger = require("../../Utils/logger");
const qs = require("qs");


function assignAssociationsAndClubs() {

  this.UploadData = async (data) => {
    try {
      // Use async/await with a for loop to sequentially fetch each item
      for (const item of data.associations) {
        try {
          const hasRow = await this.isExisting(item.PlayHQID, "associations");
          if (!hasRow) {
            logger.info(`Try data store for association ${item.Name}.`);
          
            const response = await fetcher("associations", "POST", { data: item });
            logger.info(`Stored data for association ${item.Name}. Status: ${response.status}`);
          } else {
            logger.info(`${item.Name} is already stored`);
          }
        } catch (error) {
          logger.error(`Error uploading data for association ${item.Name}. Error: ${error}`);
        }
      }

      for (const item of data.clubs) {
        try {
          const hasRow = await this.isExisting(item.PlayHQID, "clubs");
          if (!hasRow) {
            logger.info(`Try data store for Club ${item.Name}.`);
           
            const response = await fetcher("clubs", "POST", { data: item });
            logger.info(`Stored data for club ${item.Name}. Status: ${response.status}`);
          } else {
            logger.info(`${item.Name} is already stored`);
          }
        } catch (error) {
          logger.error(`Error uploading data for club ${item.Name}. Error: ${error}`);
        }
      }
    } catch (error) {
      logger.error(`Error uploading data to Strapi. Error: ${error}`);
    }
  };

  this.isExisting = async (PLAYHQID, PATH) => {
    try {
      const query = qs.stringify(
        {
          filters: {
            PlayHQID: {
              $eq: PLAYHQID,
            },
          },
        },
        {
          encodeValuesOnly: true,
        }
      );
      const response = await fetcher(`${PATH}?${query}`);
      if (response.length === 0 || response.status === 404) {
        return false;
      } else {
        return true;
      }
    } catch (error) {
      logger.error(`Error checking if ${PATH} with PlayHQID ${PLAYHQID} exists. Error: ${error}`);
      return true; // return true to prevent unintentional duplicates
    }
  };
}

module.exports = assignAssociationsAndClubs;
