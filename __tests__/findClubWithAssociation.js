/**
 * Quick script to find a club that has a specific association
 * Usage: node __tests__/findClubWithAssociation.js <associationId>
 */

require("dotenv").config();
const CRUDOperations = require("../dataProcessing/services/CRUDoperations");

async function findClubWithAssociation(associationId) {
  const crudOps = new CRUDOperations();

  try {
    // Fetch the association to see which clubs it's associated with
    console.log(`📋 Fetching association ${associationId}...`);
    const associationData = await crudOps.fetchDataForAssociation(associationId);

    if (!associationData || !associationData.attributes) {
      console.error(`❌ Association ${associationId} not found`);
      process.exit(1);
    }

    const clubs = associationData.attributes.clubs?.data || [];
    console.log(`✅ Found ${clubs.length} clubs in association ${associationId}\n`);

    if (clubs.length === 0) {
      console.log("⚠️  No clubs found in this association");
      process.exit(0);
    }

    // Now find a club that has multiple associations (for parallel testing)
    console.log("🔍 Looking for clubs with multiple associations...\n");

    let foundClub = null;
    for (const club of clubs.slice(0, 10)) { // Check first 10 clubs
      try {
        const clubData = await crudOps.fetchDataForClub(club.id);
        const associations = clubData.attributes.associations?.data || [];

        console.log(`  Club ${club.id}: ${associations.length} associations`);

        if (associations.length > 1) {
          foundClub = {
            id: club.id,
            name: clubData.attributes.name || club.id,
            associations: associations.length,
            associationIds: associations.map(a => a.id)
          };
          console.log(`  ✅ Found club ${foundClub.id} with ${foundClub.associations} associations!\n`);
          break;
        }
      } catch (error) {
        console.log(`  ⚠️  Error fetching club ${club.id}: ${error.message}`);
      }
    }

    if (foundClub) {
      console.log("=".repeat(80));
      console.log("Recommended test command:");
      console.log("=".repeat(80));
      console.log(`node __tests__/testParallelCompetitions.js ${foundClub.id} club\n`);
      console.log(`This club has ${foundClub.associations} associations, perfect for testing parallel processing!`);
    } else {
      console.log("\n⚠️  No club with multiple associations found in the first 10 clubs.");
      console.log("You can still test with any of these clubs, but they may only have 1 association.");
      if (clubs.length > 0) {
        console.log(`\nTry: node __tests__/testParallelCompetitions.js ${clubs[0].id} club`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

const associationId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

if (!associationId) {
  console.error("❌ Please provide an association ID");
  console.log("Usage: node __tests__/findClubWithAssociation.js <associationId>");
  console.log("Example: node __tests__/findClubWithAssociation.js 2760");
  process.exit(1);
}

findClubWithAssociation(associationId);

