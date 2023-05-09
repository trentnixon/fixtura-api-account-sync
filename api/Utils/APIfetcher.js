const fetch = require("node-fetch");
const dotenv = require("dotenv");
dotenv.config();

async function fetcher(domain, PATH, method = "GET", body = {}) {
  const APIURL = process.env.FIXTURA_API;

  // Add fetcher options
  const options = {
    method,
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIXTURA_TOKEN}`,
    },
  };

  //. if POST or PUT then add a body
  if (method === 'POST' ||method === 'PUT') {
    options.body = JSON.stringify(body);
  }



  try {
    const response = await fetch(`${APIURL}${PATH}`,options);
    const res = await response.json();
    return res.data;
  } catch (error) {
    console.log('Fetcher Error : ')
    console.error(error);
  }
}

module.exports = fetcher;
