const dotenv = require('dotenv')
dotenv.config()
const {request,gql} = require('graphql-request')
const {TwitterClient} = require('twitter-api-client');
const axios = require('axios')
const OAuth = require('oauth')
const fs =  require('fs')

async function getPoolInfo(networkID,address){
  const poolInfoJson = require('./pools.json')
  for (coin in poolInfoJson[networkID]){
    if (poolInfoJson[networkID][coin].address.toLowerCase() ==  address.toLowerCase()) {
      return poolInfoJson[networkID][coin]
    }
  }
}


async function imageUpload(){
  const userClient = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_SECRET
  });

  randomImageArray = ["SundayYieldReview.png"]

  let image = await fs.readFileSync("./tweet_images/" + randomImageArray[Math.floor(Math.random()*0)]).toString('base64')
  data = await userClient.media.mediaUpload({media_data:image}).then().catch((err) => console.log(err))
  return data
}
  

async function tweetDeposit(tweet){
 const userClient = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_SECRET
  });
  

  let media = await imageUpload()
  const data = userClient.tweetsV2.createTweet({"text":tweet,"media": {"media_ids": [media.media_id_string]}}).then((data) => console.log(data)).catch((data)=>console.log(data))
}

function generateDepositTweet(pool,poolInfo,depositNumber,chain){
  const secondsInYear = 31556952
  let fixedRate = (((Number(pool.deposits[depositNumber].interestRate) * secondsInYear )/(Number(pool.deposits[depositNumber].depositLength)))*100).toFixed(3)
  let mphRewards = (Number(pool.poolDepositorRewardMintMultiplier)*(Number(pool.deposits[depositNumber].depositLength)*(Number(pool.deposits[depositNumber].amount))))
  const maturationDate =  String(new Date(pool.deposits[depositNumber].maturationTimestamp*1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          timeZoneName: 'short',
        })).split(' ')[0].replaceAll(',','')
  let tweet = "New deposit on $MPH! 🚀\n" + Number(pool.deposits[depositNumber].amount).toFixed(4) + " $" +  poolInfo.stablecoinSymbol  
   + " put to work in the " + "$" + poolInfo.protocol.toUpperCase() + " protocol\n" + "Earning "  +
   + fixedRate + "%" + " APR and " + mphRewards.toFixed(2) + " $MPH on "+ chain.toUpperCase() + " until " + maturationDate + "\n" +
   "Start earning fixed APR 🤑, speculating on yield 💸 , & letting DeFi work for you 💰💰💰 at https://88mph.app \n"

  return tweet
}

async function checkDeposits(queryString,graphEndpoint,networkID,chain){
  const data =  await request(graphEndpoint,queryString)
  const latestDeposits = require('./latestDeposits.json')
  let depositTimestamps = []
  for(pool of data["dpools"]){
      for (let depositNumber=0; depositNumber < pool.deposits.length; depositNumber++) {
            let poolInfo = await getPoolInfo(networkID,pool.address)
            if (BigInt(pool.deposits[depositNumber].depositTimestamp) > latestDeposits[chain]){
              depositTimestamps.push(pool.deposits[depositNumber].depositTimestamp)
              let tweet = generateDepositTweet(pool,poolInfo,depositNumber,chain)
              tweetDeposit(tweet)
            }
          }   
      }
      depositTimestamps.sort()

      return depositTimestamps[depositTimestamps.length-1] ? depositTimestamps[depositTimestamps.length-1] : latestDeposits[chain]
}

async function main() {

  CHAINS = ['ethMainNet','ethRinkeby','polygon','avalanche','fantom'];

  GRAPHQL_ENDPOINT = {
    'ethMainNet':
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3',
    'ethRinkeby':
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-rinkeby',
    'polygon':
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-polygon',
    'avalanche':
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-avalanche',
    'fantom':
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-fantom',
  };

  CHAIN_NETWORK_ID = {
    'ethMainNet': '1',
    'ethRinkeby': '4',
    'polygon': '137',
    'avalanche': '43114',
    'fantom': '250'
  }
  const secondsInDay = 86400
  const currentTime = Math.floor((Date.now()/1000)-secondsInDay)

  const queryString = gql`
    {
      dpools {
        address
        poolDepositorRewardMintMultiplier
        deposits (
          where: {
            depositTimestamp_gte: "${currentTime}",
            virtualTokenTotalSupply_gte: "0.00000001"
          }
        ) {
          amount
          interestRate
          feeRate
          depositTimestamp
          maturationTimestamp
          depositLength
        }
      }
    }
  `;
  let latestDeposits = require('./latestDeposits.json')
  let newLatestDeposits = {}
  for (const chain of CHAINS){
    newLatestDeposits[chain] = await checkDeposits(queryString,GRAPHQL_ENDPOINT[chain],CHAIN_NETWORK_ID[chain],chain) 
  }
  
  fs.writeFile('./latestDeposits.json',JSON.stringify(newLatestDeposits),err => {
    if (err) {
      console.error(err)
      return
    }
  })

}

main()


