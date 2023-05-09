const IndexCloneGetClubInfoForAssociations = require('./IndexCloneGetClubInfoForAssociations')


class getClubsAssignedToAssociationInfo {

    constructor(Clubs, competitions){
        this.Clubs=Clubs
        this.competitions = competitions
    }


  async Setup() {
    //console.log(this.Clubs)
    
    for (let i = 0; i < this.Clubs.length; i++) {
        const id = this.Clubs[i].id;
       // const url = `https://example.com/api/${id}`;
       const GetClubInfoForAssociations = new IndexCloneGetClubInfoForAssociations()
       const res = await GetClubInfoForAssociations.Setup(id, this.competitions)
        //console.log('RES ', res)
      
      }
      return true
    //const GetClubInfoForAssociations = new IndexCloneGetClubInfoForAssociations()
   /*  const browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox']  }); 
    const page = await browser.newPage();

    const Competitions =   await this.fetchCompetitions(page, this.URL)

    if (Competitions.length === 0) {
        console.log(`No competitions found for Association ${this.URL}`);
        await browser.close();
        return false;
      }

    return Competitions */
  }

}

module.exports = getClubsAssignedToAssociationInfo;
