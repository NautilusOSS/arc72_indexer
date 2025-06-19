import BigNumber from "bignumber.js";

const zeroAddress =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter(x => setB.has(x));
}


function formatToCustomISO(latestSwap) {
  if (!latestSwap) return null;

  const date = new Date(latestSwap * 1000); // Convert seconds to milliseconds
  const pad = (n) => String(n).padStart(2, '0');

  return (
    date.getUTCFullYear() +
    '-' + pad(date.getUTCMonth() + 1) +
    '-' + pad(date.getUTCDate()) +
    'T' + pad(date.getUTCHours()) +
    ':' + pad(date.getUTCMinutes()) +
    ':' + pad(date.getUTCSeconds()) +
    '+0000'
  );
}


/**
 * @swagger
 * /nft-indexer/v1/dex/integration/coingecko/historical_trades:
 *  get:
 *   summary: Retrieves arc200 token data
 *   description: Fetch arc200 token details based on query parameters (this is a NON-STANDARD endpoint)
 *   parameters:
 *     - in: query
 *       name: contractId
 *       schema:
 *         type: integer
 *         description: Limit to only results with the given contractId
 *     - in: query
 *       name: holder
 *       schema:
 *         type: string
 *         description: Include results where the given wallet address is the holder of the token
 *     - in: query
 *       name: mint-min-round
 *       schema:
 *         type: integer
 *         description: Include results minted on or after the given round.
 *     - in: query
 *       name: mint-min-round
 *       schema:
 *         type: integer
 *         description: Include results minted on or before the given round.
 *     - in: query
 *       name: next
 *       schema:
 *         type: string
 *         description: Token for the next page of results. Use the next-token provided by the previous page of results.
 *     - in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         description: Maximum number of results to return. There could be additional pages even if the limit is not reached.
 *     - in: query
 *       name: includes
 *       schema:
 *         type: string
 *         description: Comma separated list of additional properties to include in the response.
 *     - in: query
 *       name: creator
 *       schema:
 *         type: string
 *         description: Wallet address of the creator of the collection
 *   responses:
 *     200:
 *       description: A successful response
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               collection:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Collection'
 *               current-round:
 *                 type: integer
 *               next-token:
 *                 type: string
 *     400:
 *       description: Bad request
 *     500:
 *       description: Server error
 */

export const coingeckoHistoricalTradesEndpoint = async (req, res, db) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Response-Type", "application/json");

  let response = {};

  db.db.get(`SELECT value FROM info WHERE key='syncRound'`, [], (err, row) => {
    if (err) {
      res.status(500).json({ message: "Error querying the database" });
      return;
    }

    // Construct response
    response = {
      ["current-round"]: Number(row.value),
    };
  });


/*
Endpoint parameters:
- ticker_id
- type
- limit
- start_time
- end_time
*/


  // Extract query parameters
  const tickerId = req.query.ticker_id;
  const type = req.query.type;
  const limit = req.query.limit;
  const startTime = req.query.start_time;
  const endTime = req.query.end_time;

  // Construct SQL query

  let query = "";
  let conditions = [];
  let params = {};
 
    query += `
SELECT * FROM (
SELECT
  s.contractId AS contract_id,
  s.transactionId AS trade_id,
  s.outBalA as outBalA,
  s.outBalB as outBalB,
  s.inBalA as inBalA,
  s.inBalB as inBalB,
  cA.decimals as decimalsA,
  cB.decimals as decimalsB,
  ROUND(
    (CAST(s.outBalA AS REAL) / POW(10, cA.decimals)) /
    NULLIF(CAST(s.inBalB AS REAL) / POW(10, cB.decimals), 0), 6
  ) AS price,
  ROUND(CAST(s.outBalA AS REAL) / POW(10, cA.decimals), 6) AS base_volume,
  ROUND(CAST(s.inBalB AS REAL) / POW(10, cB.decimals), 6) AS target_volume,
  s.timestamp AS trade_timestamp,
  'buy' AS type,
  p.tokAId || '_' || p.tokBId AS ticker_id
FROM event_dex_swaps s
JOIN dex_pool p ON s.contractId = p.contractId
JOIN contracts_0200 cA ON p.tokAId = cA.contractId
JOIN contracts_0200 cB ON p.tokBId = cB.contractId
WHERE s.inBalB > 0 AND s.outBalA > 0

UNION ALL

SELECT
  s.contractId AS contract_id,
  s.transactionId AS trade_id,
  s.outBalA as outBalA,
  s.outBalB as outBalB,
  s.inBalA as inBalA,
  s.inBalB as inBalB,
  cA.decimals as decimalsA,
  cB.decimals as decimalsB,
  ROUND(
    1/((CAST(s.outBalB AS REAL) / POW(10, cB.decimals)) /
    NULLIF(CAST(s.inBalA AS REAL) / POW(10, cA.decimals), 0)), 6
  ) AS price,
  ROUND(CAST(s.inBalA AS REAL) / POW(10, cA.decimals), 6) AS base_volume,
  ROUND(CAST(s.outBalB AS REAL) / POW(10, cB.decimals), 6) AS target_volume,
  s.timestamp AS trade_timestamp,
  'sell' AS type,
  p.tokAId || '_' || p.tokBId AS ticker_id
FROM event_dex_swaps s
JOIN dex_pool p ON s.contractId = p.contractId
JOIN contracts_0200 cA ON p.tokAId = cA.contractId
JOIN contracts_0200 cB ON p.tokBId = cB.contractId
WHERE s.inBalA > 0 AND s.outBalB > 0
)
    `;

  if (tickerId) {
    const [a,b] = tickerId.split('_')
    const na = a === '0' ? '390001' : a;
    const nb = b === '0' ? '390001' : b;
    const nTickerId = `${na}_${nb}`;
    conditions.push(`ticker_id = $tickerId`);
    params.$tickerId = nTickerId;
  }

  if (type) {
    conditions.push(`type = $type`);
    params.$type = type;
  }

  if (startTime) {
    conditions.push(`trade_timestamp >= $startTime`);
    params.$startTime = startTime;
  }

  if (endTime) {
    conditions.push(`trade_timestamp >= $endTime`);
    params.$endTime = endTime;
  }

  if (conditions.length > 0) {
  	query += ` WHERE ` + conditions.join(" AND ");
  }

  query += ` ORDER BY trade_timestamp DESC`;

  if (limit) {
    query += ` LIMIT $limit`;
    params.$limit = limit;
  }

  // Execute query
  const rows = await db.all(query, params);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    row.contractId = Number(row.contractId);
    row.mintRound = Number(row.createRound);
    delete row.lastSyncRound;
    delete row.createRound;
  }

  // get round of last row
  let maxRound = 0;
  if (rows.length > 0) {
    maxRound = rows[rows.length - 1].mintRound;
  }

  //response["pools"] = rows;
  //response["next-token"] = maxRound + 1;
  console.log(rows);
  const mapHistoricTrade = (r) => ({
            "trade_id":r.trade_id,
            "price": new BigNumber(r.price).toFixed(r.decimalsA),
            "base_volume":r.base_volume,
            "target_volume":r.target_volume,
            "trade_timestamp":r.trade_timestamp,
            "type":r.type,
	    // extra fields
	    "contract_id": r.contract_id,
	    "ticker_id": r.ticker_id
  })
  res.status(200).json({
      "buy": rows.filter(r => r.type === "buy").map(mapHistoricTrade),
      "sell": rows.filter(r => r.type === "sell").map(mapHistoricTrade)
  })

  // Log date/time, ip address, query
  const date = new Date();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.error(
    `${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`
  );
};
