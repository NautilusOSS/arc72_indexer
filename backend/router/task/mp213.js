import { CONTRACT, abi } from "ulujs";
import { algodClient, indexerClient, decodeMpCurrencyData, db } from "../../utils.js";
import algosdk from "algosdk";

// ListEvent: [UInt256, Contract, UInt256, Address, Price], // ListId, CollectionId, TokenId, ListAddr, ListPrice
// AcceptEvent: [UInt256], // ListId
// DeleteListingEvent: [UInt256], // ListId

// getListingEvent
//  - convert event tuple to object
const getListingEvent = (event) => {
  const [
    transactionId,
    createRound,
    createTimestamp,
    mpListingId,
    collectionId,
    tokenId,
    listAddr,
    currencyData,
  ] = event;
  const { currency, price } = decodeMpCurrencyData(currencyData);
  const listing = {
    transactionId,
    createRound: Number(createRound),
    createTimestamp: Number(createTimestamp),
    mpListingId: Number(mpListingId),
    contractId: Number(collectionId),
    tokenId: String(tokenId),
    offerer: listAddr,
    currency,
    price,
  };
  return listing;
};

// getClaimEvent
//  - convert event tuple to object
const getAcceptEvent = (event) => {
  const [transactionId, round, timestamp, listingId] = event;
  return {
    transactionId,
    round,
    timestamp,
    listingId,
  };
};

// TODO get this function from ulujs
// getDeleteEvent
//  - convert event tuple to object
const getDeleteEvent = (event) => {
  const [transactionId, round, timestamp, listingId] = event;
  return {
    transactionId,
    round,
    timestamp,
    listingId,
  };
};

// makeContract
//  - return marketplace contract instance
const makeContract = (contractId) =>
  new CONTRACT(contractId, algodClient, indexerClient, {
	  name: "mp213",
	  desc: "mp213",
	  methods: [],
		events: [
// ListEvent: [UInt256, Contract, UInt256, Address, Price], // ListId, CollectionId, TokenId, ListAddr, ListPrice
// AcceptEvent: [UInt256], // ListId
// DeleteListingEvent: [UInt256], // ListId
			{
      name: "e_offer_ListEvent",
      args: [
        {
          type: "uint256",
          name: "listingId",
        },
        {
          type: "uint64",
          name: "contractId",
        },
        {
          type: "uint256",
          name: "tokenId",
        },
        {
          type: "address",
          name: "listAddr",
        },
        {
          type: "(byte,byte[40])",
          name: "listPrice",
        },
      ],
    },
    {
      name: "e_offer_AcceptEvent",
      args: [
        {
          type: "uint256",
          name: "listingId",
        },
      ],
    },
    {
      name: "e_offer_DeleteListingEvent",
      args: [
        {
          type: "uint256",
          name: "listingId",
        },
      ],
    },
	  ]
  })

// onListing
//  - process listing event
const onListing = async (ci, events) => {
  const contractId = ci.getContractId();
  const listEvents = events.find(el => el.name === "e_offer_ListEvent").events;
  console.log(
    `Processing ${listEvents.length} listing events for contract ${contractId}`
  );
  for await (const event of listEvents) {
    const listingEvent = getListingEvent(event);
    const listing = {
      ...listingEvent,
      mpContractId: contractId,
    }
    console.log("listing", listing);
    await db.insertOrUpdateOfferListing(listing);
  }
};

// onAccept
//  - process accept event
const onAccept = async (ci, events, sender) => {
  const contractId = ci.getContractId();
  const acceptEvents = events.find(el => el.name === "e_offer_AcceptEvent").events;
  console.log(
    `Processing ${acceptEvents.length} accept events for contract ${contractId}`
  );
  for await (const event of acceptEvents) {
    const { transactionId, round, timestamp, listingId } =
      getAcceptEvent(event);
    const listing = await db.getOfferListing(contractId, listingId);
    if (listing) {
      const mpAccept = {
        transactionId,
        mpContractId: listing.mpContractId,
        mpListingId: listing.mpListingId,
        contractId: listing.contractId,
        tokenId: listing.tokenId,
        accepter: sender,
        round,
        timestamp
      };
      const mpListing = {
        transactionId: listing.transactionId,
        mpContractId: listing.mpContractId,
        mpListingId: listing.mpListingId,
        tokenId: listing.tokenId,
        contractId: listing.contractId,
        offerer: listing.offerer,
        price: listing.price,
        currency: listing.currency,
        createRound: listing.createRound,
        createTimestamp: listing.createTimestamp,
        accept_id: transactionId,
        delete_id: listing.delete_id,
      };
      await db.insertOrUpdateOfferAccept(mpAccept);
      await db.insertOrUpdateOfferListing(mpListing);
    } else {
      console.log(`Listing ${contractId} ${listingId} not found in database`);
    }
  }
};

// onDelete
//  - process delete event
const onDelete = async (ci, events, sender) => {
  const contractId = ci.getContractId();
  const deleteEvents = events.find(
    el => el.name === "e_offer_DeleteListingEvent"
  ).events;
  console.log(
    `Processing ${deleteEvents.length} delete events for contract ${contractId}`
  );
  // for each event, record a transaction in the database
  for await (const event of deleteEvents) {
    const { transactionId, round, timestamp, listingId } =
      getDeleteEvent(event);
    // get market listing
    const listing = await db.getOfferListing(contractId, listingId);
    if (listing) {
      const mpDelete = {
        transactionId,
        mpContractId: listing.mpContractId,
        mpListingId: listing.mpListingId,
        contractId: listing.contractId,
        tokenId: listing.tokenId,
        round,
        timestamp,
	deleter: sender
      };
      const mpListing = {
        transactionId: listing.transactionId,
        mpContractId: listing.mpContractId,
        mpListingId: listing.mpListingId,
        tokenId: listing.tokenId,
        contractId: listing.contractId,
        offerer: listing.offerer,
        price: listing.price,
        currency: listing.currency,
        createRound: listing.createRound,
        createTimestamp: listing.createTimestamp,
        endTimestamp: listing.endTimestamp,
        royalty: listing.royalty,
        accept_id: listing.accept_id,
        delete_id: transactionId,
      };
      await db.insertOrUpdateOfferDelete(mpDelete);
      await db.insertOrUpdateOfferListing(mpListing);
    } else {
      console.log(`Listing ${contractId} ${listingId} not found in database`);
    }
  }
};

// updateLastSync
//  - update marketplace sync record
const updateLastSync = async (contractId, round) => {
  // update lastSyncRound for market
  await db.updateMarketLastSync(contractId, round);
  console.log(
    `Updated lastSyncRound for market contract ${contractId} to ${round}`
  );
};

// doIndex
//  - update marketplace info and process events
const doIndex = async (app, round) => {
  const contractId = app.apid;
  console.log(app, round);
  const ci = makeContract(contractId);
  let lastSyncRound;
  if (app.isCreate) {
/*
    lastSyncRound = round;
    console.log(`Adding new contract ${contractId} to markets table in round ${round}`);
    const escrowAddr = algosdk.getApplicationAddress(Number(contractId));
    const createRound = round;
    const isBlacklisted = 0;
    const market = {
      contractId,
      escrowAddr,
      createRound,
      lastSyncRound,
      isBlacklisted,
    };
    await db.insertOrUpdateMarket(market);
*/
  } else {
/*
    lastSyncRound = await db.getMarketLastSync(contractId);
    console.log(
      `Updating contract ${contractId} in markets table from round ${lastSyncRound} to ${round}`
    );
*/
  }
  //if (lastSyncRound <= round) {
    const events = await ci.getEvents({
      //minRound: lastSyncRound,
      minRound: round,
      maxRound: round,
    });
    console.log({events});
    await onListing(ci, events);
    await onAccept(ci, events, app.sender);
    await onDelete(ci, events, app.sender);
    //await updateLastSync(contractId, round);
  //}
};

export default doIndex;
