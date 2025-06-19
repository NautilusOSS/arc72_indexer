const zeroAddress =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

function intersect(a, b) {
  var setB = new Set(b);
  return [...new Set(a)].filter(x => setB.has(x));
}

/**
 * @swagger
 * /nft-indexer/v1/dex/swaps:
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

export const dexSwapsEndpoint = async (req, res, db) => {
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

  // Extract query parameters

  const transactionId = req.query.transactionId;
  const contractId = req.query.contractId;
  const timestamp = req.query.timestamp;

  let minTimestamp = req.query["min-timestamp"] 
  let maxTimestamp = req.query["max-timestamp"] 

  const tokenId = req.query["tokenId"];
  const creator = req.query.creator;
  const next = req.query.next ?? 0;
  const limit = req.query.limit;
  const offset = req.query.offset;

  // Construct SQL query

  let query = "";
  let conditions = [];
  let params = {};
 
    query += `
SELECT 
    e.transactionId,
    e.contractId,
    e.timestamp,
    e.round,
    d.symbolA,
    d.symbolB,
    CAST(e.poolBalA AS REAL) / POWER(10, COALESCE(a.decimals, 0)) AS poolBalA,
    CAST(e.poolBalB AS REAL) / POWER(10, COALESCE(b.decimals, 0)) AS poolBalB,
    (CAST(e.poolBalA AS REAL) / POWER(10, COALESCE(a.decimals, 0))) /
    NULLIF((CAST(e.poolBalB AS REAL) / POWER(10, COALESCE(b.decimals, 0))), 0) AS price,
    CAST(e.inBalA AS REAL) / POWER(10, COALESCE(a.decimals, 0)) AS inBalA,
    CAST(e.inBalB AS REAL) / POWER(10, COALESCE(b.decimals, 0)) AS inBalB,
    CAST(e.outBalA AS REAL) / POWER(10, COALESCE(a.decimals, 0)) AS outBalA,
    CAST(e.outBalB AS REAL) / POWER(10, COALESCE(b.decimals, 0)) AS outBalB,
    COUNT(*) OVER () AS totalSwaps
FROM event_dex_swaps e
JOIN dex_pool d ON e.contractId = d.contractId
JOIN contracts_0200 a ON d.tokAId = a.contractId
JOIN contracts_0200 b ON d.tokBId = b.contractId
    `;

  if (contractId) {
    conditions.push(`e.contractId = $contractId`);
    params.$contractId = contractId;
  }

  if (minTimestamp) {
    if (maxTimestamp) {
        conditions.push(`e.timestamp BETWEEN $minTimestamp AND $maxTimestamp`);
        params.$minTimestamp = minTimestamp;
        params.$maxTimestamp = maxTimestamp;
    } else {
        conditions.push(`e.timestamp >= $minTimestamp`);
        params.$minTimestamp = minTimestamp;
    }
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(" AND ");
  }

  query += ` ORDER BY e.timestamp DESC`;

  if (limit) {
    query += ` LIMIT $limit`;
    params.$limit = limit;
  }

  if (offset) {
    query += " OFFSET $offset";
    params.$offset = offset;
  }

  // Execute query
  const rows = await db.all(query, params);

  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.contractId = Number(row.contractId);
    if(!total) total = Number(row.totalSwaps);
    delete row.totalSwaps;
    delete row.lastSyncRound;
    delete row.createRound;
  }

  // get round of last row
  let maxRound = 0;
  if (rows.length > 0) {
    maxRound = rows[rows.length - 1].mintRound;
  }

  response["total"] = total;
  response["swaps"] = rows;
  response["next-token"] = maxRound + 1;
  res.status(200).json(response);

  // Log date/time, ip address, query
  const date = new Date();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.error(
    `${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`
  );
};
