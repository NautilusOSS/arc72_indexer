const zeroAddress =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

/**
 * @swagger
 * /nft-indexer/v1/arc200/balances:
 *  get:
 *   summary: Retrieves arc200 token balance data
 *   description: Fetch arc200 token details based on query parameters (this is a NON-STANDARD endpoint)
 *   parameters:
 *     - in: query
 *       name: contractId
 *       schema:
 *         type: integer
 *         description: Limit to only results with the given contractId
 *     - in: query
 *       name: accountId
 *       schema:
 *         type: string
 *         description: Include results where the given wallet address is the holder of the token
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
export const accounts0200Endpoint = async (req, res, db) => {
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
  const contractId = req.query.contractId;
  const accountId = req.query.accountId;
  const next = req.query.next ?? 0;
  const limit = req.query.limit 
  const offset = req.query.offset 

  // "includes" is a query parameter that can be used to include additional data in the response
  const includes = req.query.includes?.split(",") ?? [];

  // Construct SQL query

    let query;
    query = `
SELECT
  ab.contractId,
  ab.accountId,
  ab.balance, -- Keeping balance as TEXT in the SELECT statement
  t.symbol,
  t.decimals,
  v.verified,
  r.tokenId,
  COUNT(*) OVER () AS total_results
FROM
  account_balances_0200 ab
LEFT JOIN 
    contracts_0200 t
ON
    ab.contractId = t.contractId 
LEFT JOIN
    verification_requests v
ON 
    CAST(ab.contractId AS TEXT) = v.assetId
LEFT JOIN 
    (SELECT 
        r.contractId, 
        GROUP_CONCAT(r.tokenId) AS tokenId
     FROM
        contract_tokens_0200 r 
     GROUP BY  
        r.contractId) r
ON 
    ab.contractId = r.contractId
`;

    let conditions = [];
    let params = {};

    if (contractId) {
      conditions.push(`ab.contractId = $contractId`);
      params.$contractId = contractId;
    }

    if (accountId) {
      conditions.push(`ab.accountId = $accountId`);
      params.$accountId = accountId;
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY ab.contractId, CAST(ab.balance AS NUMERIC) DESC `

    if (limit) {
      query += ` LIMIT $limit`;
      params.$limit = limit;
      if(offset) {
        query += ` OFFSET $offset`;
        params.$offset = offset;
	
      }
    }

  // Execute query
  const rows = await db.all(query, params);

  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.contractId = Number(row.contractId);
    if(!total) total = Number(row.total_results);
    delete row.total_results;
  }

  // get round of last row
  let maxRound = 0;
  if (rows.length > 0) {
    maxRound = rows[rows.length - 1].mintRound;
  }

  response["balances"] = rows;
  response["next-token"] = maxRound + 1;
  response["total"] = total;

  res.status(200).json(response);

  // Log date/time, ip address, query
  const date = new Date();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(
    `${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`
  );
};
