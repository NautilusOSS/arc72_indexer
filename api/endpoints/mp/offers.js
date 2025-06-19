/**
 * @swagger
 * /nft-indexer/v1/mp/offers:
 *  get:
 *   summary: Retrieves marketplace listings
 *   description: Fetch marketplace listing details based on query parameters (this is a NON-STANDARD endpoint)
 *   parameters:
 *     - in: query
 *       name: mpContractId
 *       schema:
 *         type: integer
 *         description: Limit to only the listings with the given Marketplace contractId
 *     - in: query
 *       name: mpListingId
 *       schema:
 *         type: integer
 *         description: Limit to only the listings with the given Marketplace listingId (requires mpContractId)
 *     - in: query
 *       name: collectionId
 *       schema:
 *         type: integer
 *         description: Limit to only the listings with the given collectionId (also accepts array of integers)
 *     - in: query
 *       name: tokenId
 *       schema:
 *         type: integer
 *         description: Limit to only the listings with the given tokenId (requires collectionId) (also accepts array of integers)
 *     - in: query
 *       name: seller
 *       schema:
 *         type: string
 *         description: Limit to only the listings with the given seller
 *     - in: query
 *       name: escrow-addr
 *       schema:
 *         type: string
 *         description: Limit to only the listings on marketplaces with the given escrow address
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
 *         description: Limit to only the listings with the price greater than or equal to the given price
 *     - in: query
 *       name: max-price
 *       schema:
 *         type: integer
 *         description: Limit to only the listings with the price less than or equal to the given price
  *     - in: query
 *       name: min-time
 *       schema:
 *         type: integer
 *         description: Limit to only the listings which occurred on or after the given timestamp
 *     - in: query
 *       name: max-time
 *       schema:
 *         type: integer
 *         description: Limit to only the listings which occurred on or before the given timestamp
*     - in: query
 *       name: currency
 *       schema:
 *         type: string
 *         description: Limit to only the listings with the given currency
 *     - in: query
 *       name: active
 *       schema:
 *         type: boolean
 *         description: Limit to only the active listings
 *     - in: query
 *       name: sold
 *       schema:
 *         type: boolean
 *         description: Limit to only sold listings
 *     - in: query
 *       name: deleted
 *       schema:
 *         type: boolean
 *         description: Limit to only deleted listings
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
 *                   $ref: '#/components/schemas/Listing'
 *               current-round:
 *                 type: integer
 *               next-token:
 *                 type: string
 *     400:
 *       description: Bad request
 *     500:
 *       description: Server error 
 */
export const offersEndpoint = async (req, res, db) => {
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
    const transactionId = req.query.transactionId;
    const mpContractId = req.query.mpContractId;
    const mpListingId = req.query.mpListingId;
    const collectionId = req.query.collectionId;
    const tokenId = req.query.tokenId;
    const offerer = req.query.offerer;
    const owner = req.query.owner;
    const minRound = req.query['min-round']??0;
    const maxRound = req.query['max-round'];
    const minPrice = req.query['min-price'];
    const maxPrice = req.query['max-price'];
    const minTime = req.query['min-time'];
    const maxTime = req.query['max-time'];
    const currency = req.query.currency;
    const active = req.query['active'];
    const next = req.query.next??0;
    const limit = req.query.limit;

    // Construct SQL query
    let query = `
 SELECT 
    ol.*,
    t.owner,
    CASE 
        WHEN ol.accept_id IS NULL AND ol.delete_id IS NULL THEN TRUE 
        ELSE FALSE 
    END AS active
FROM offer_listings ol
JOIN tokens t ON ol.contractId = t.contractId AND ol.tokenId = t.tokenId
    `;
    let conditions = [];
    let params = {};

    if (transactionId) {
        conditions.push(`ol.transactionId = $transactionId`);
        params.$transactionId = transactionId;
    }

    if (owner) {
        conditions.push(`t.owner = $owner`);
        params.$owner = owner;
    }

    if (mpContractId) {
        conditions.push(`ol.mpContractId = $contractId`);
        params.$contractId = mpContractId;

        if (mpListingId) {
            conditions.push(`ol.mpListingId = $listingId`);
            params.$listingId = mpListingId;
        }
    }

    if (collectionId) {
        if (Array.isArray(collectionId)) {
            conditions.push(`ol.contractId IN (${collectionId.map((_, i) => `$collectionId${i}`).join(',')})`);
            collectionId.forEach((c, i) => {
                params[`$collectionId${i}`] = c;
            });
        } else {
            conditions.push(`ol.contractId = $collectionId`);
            params.$collectionId = collectionId;
        }

        if (tokenId) {
            if (Array.isArray(tokenId)) {
                conditions.push(`ol.tokenId IN (${tokenId.map((_, i) => `$tokenId${i}`).join(',')})`);
                tokenId.forEach((t, i) => {
                    params[`$tokenId${i}`] = t;
                });
            }
            else {
                conditions.push(`ol.tokenId = $tokenId`);
                params.$tokenId = tokenId;
            }
        }
    }

    if (offerer) {
        if (Array.isArray(offerer)) {
            conditions.push(`ol.offerer IN (${offerer.map((_, i) => `$offerer${i}`).join(',')})`);
            offerer.forEach((s, i) => {
                params[`$offerer${i}`] = s;
            });
        } else {
            conditions.push(`offerer = $offerer`);
            params.$offerer = offerer;
        }
    }


    if (minRound) {
        conditions.push(`ol.createRound >= $minRound`);
        params.$minRound = minRound;
    }

    if (maxRound) {
        conditions.push(`ol.createRound <= $maxRound`);
        params.$maxRound = maxRound;
    }

    if (minPrice) {
        conditions.push(`ol.price >= $minPrice`);
        params.$minPrice = minPrice;
    }

    if (maxPrice) {
        conditions.push(`ol.price <= $maxPrice`);
        params.$maxPrice = maxPrice;
    }

    if (minTime) {
        conditions.push(`ol.createTimestamp >= $minTime`);
        params.$minTime = minTime;
    }

    if (maxTime) {
        conditions.push(`ol.createTimestamp <= $maxTime`);
        params.$maxTime = maxTime;
    }

    if (currency) {
        conditions.push(`ol.currency = $currency`);
        params.$currency = currency;
    }

    if (active) {
        conditions.push(`ol.accept_id IS NULL AND ol.delete_id IS NULL`);
    }

    if (next) {
        conditions.push(`ol.createRound >= $next`);
        params.$next = next;
    }

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY createRound ASC`;

    if (limit) {
        query += ` LIMIT $limit`;
        params.$limit = limit;
    }

    // Execute query
    const rows = await db.all(query, params);

    // for all rows, change remove tokenIndex and change mintRound to mint-round
    let listings = [];
    for(let i = 0; i < rows.length; i++) {
        const row = rows[i];

        row.mpContractId = Number(row.mpContractId);
        row.mpListingId = Number(row.mpListingId);
        row.collectionId = Number(row.contractId);
        row.createRound = Number(row.createRound);
	row.contractId = Number(row.contractId);
        row.tokenId = String(row.tokenId);
        row.price = Number(row.price);
        row.currency = Number(row.currency);
        row.createRound = Number(row.createRound);

        listings.push(row);
    }

    let mRound = 0;
    if (listings.length > 0) {
        mRound = listings[listings.length-1].createRound;
    }

    response['offers'] = listings;
    response['next-token'] = mRound+1;
    res.status(200).json(response);

    // Log date/time, ip address, query
    const date = new Date();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`);
}
