const zeroAddress =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

/**
 * @swagger
 * /nft-indexer/v1/stats/arc200/wvoi:
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
export const stats0200WVoiEndpoint = async (req, res, db) => {
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

    let query;
    query = `
SELECT 
    ab.contractId,
    COUNT(ab.accountId) AS account_count,
    CAST(CAST(SUM(CAST(ab.balance AS REAL)) AS INTEGER) AS TEXT) AS adjusted_total_balance
FROM 
    account_balances_0200 AS ab
JOIN 
    contract_tokens_0200 AS ct
ON 
    ab.contractId = ct.contractId
WHERE 
    ct.tokenId = "0" AND
    SUBSTR(ab.balance, 1, 15) != '115792089237316'
GROUP BY 
    ab.contractId;

`;

  let conditions = [];
  let params = {};


  // Execute query
  const rows = await db.all(query, params);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.contractId = Number(row.contractId);
  }

  response["tokens"] = rows;

  res.status(200).json(response);

  // Log date/time, ip address, query
  const date = new Date();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(
    `${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`
  );
};
