/**
 * @swagger
 * /nft-indexer/v1/mp/stats:
 *  get:
 *   summary: Retrieves marketplace sales
 *   description: Fetch marketplace sales details based on query parameters (this is a NON-STANDARD endpoint)
 *   parameters:
 *     - in: query
 *       name: mpContractId
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the given Marketplace contractId
 *     - in: query
 *       name: mpListingId
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the given Marketplace listingId (requires mpContractId)
 *     - in: query
 *       name: collectionId
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the given collectionId (also accepts array of integers)
 *     - in: query
 *       name: tokenId
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the given tokenId (requires collectionId) (also accepts array of integers)
 *     - in: query
 *       name: seller
 *       schema:
 *         type: string
 *         description: Limit to only the sales with the given seller (also accepts array of strings)
 *     - in: query
 *       name: buyer
 *       schema:
 *         type: string
 *         description: Limit to only the sales with the given buyer (also accepts array of strings)
 *     - in: query
 *       name: min-round
 *       schema:
 *         type: integer
 *         description: Include results to listings created on or after the given round.
 *     - in: query
 *       name: max-round
 *       schema:
 *         type: integer
 *         description: Include results to listings created on or before the given round.
 *     - in: query
 *       name: min-price
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the price greater than or equal to the given price
 *     - in: query
 *       name: max-price
 *       schema:
 *         type: integer
 *         description: Limit to only the sales with the price less than or equal to the given price
 *     - in: query
 *       name: min-time
 *       schema:
 *         type: integer
 *         description: Limit to only the sales which occurred on or after the given timestamp
 *     - in: query
 *       name: max-time
 *       schema:
 *         type: integer
 *         description: Limit to only the sales which occurred on or before the given timestamp
 *     - in: query
 *       name: sort
 *       schema:
 *         type: string
 *         description: "Sort by a given field, currently supports 'round'. Use '-' to sort in descending order. Example: sort=-round. NOTE: next token does not work with this option."
 *     - in: query
 *       name: currency
 *       schema:
 *         type: string
 *         description: Limit to only the sales with the given currency
 *     - in: query
 *       name: next
 *       schema:
 *         type: string
 *         description: Token for the next page of results. Use the next-token provided by the previous page of results.
 *   responses:
 *     200:
 *       description: A successful response
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listings:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Sale'
 *               current-round:
 *                 type: integer
 *               next-token:
 *                 type: string
 *     400:
 *       description: Bad request
 *     500:
 *       description: Server error 
 */
export const mpStatsEndpoint = async (req, res, db) => {
    let response = {};

    db.db.get(`SELECT value FROM info WHERE key='syncRound'`, [], (err, row) => {
        if (err) {
            res.status(500).json({ message: 'Error querying the database' });
            return;
        }

        // Construct response
        response = {
            ['current-round']: Number(row.value),
        };
    });

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Response-Type', 'application/json');

    // Extract query parameters

    // Construct SQL query
    let query = `
SELECT 
    CAST(ROUND(SUM(price), 0) AS TEXT) AS total_volume, 
    COUNT(*) AS total_sales,
    COUNT(DISTINCT contractId || '-' || tokenId) AS unique_pairs,
    COUNT(DISTINCT buyer) AS unique_buyers,
    COUNT(DISTINCT seller) AS unique_sellers,
    COUNT(DISTINCT contractId) AS total_collections,
    (SELECT COUNT(DISTINCT user) 
     FROM (
        SELECT seller AS user FROM sales WHERE currency IN ('0', '390001')
        UNION
        SELECT buyer AS user FROM sales WHERE currency IN ('0', '390001')
        UNION
        SELECT seller AS user FROM listings
     ) AS combined_users
     WHERE user IS NOT NULL) AS active_users,
    (SELECT SUM(price) / 5000000.0 FROM sales WHERE CAST(mpListingId AS INTEGER) >= 1656) AS ten_percent
FROM sales
WHERE currency IN ('0', '390001');
`;
    let conditions = [];
    let params = {};

    // Execute query
    const rows = await db.all(query, params);

    // for all rows, change remove tokenIndex and change mintRound to mint-round
    for(let i = 0; i < rows.length; i++) {
        const row = rows[i];
    }

    response.stats = rows
    res.status(200).json(response);

    // Log date/time, ip address, query
    const date = new Date();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`);
}
