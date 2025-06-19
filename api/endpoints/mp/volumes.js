/**
 * @swagger
 * /nft-indexer/v1/mp/volumes:
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
export const saleVolumesEndpoint = async (req, res, db) => {
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
    const seller = req.query.seller;
    const buyer = req.query.buyer;
    const currency = req.query.currency;
    const next = req.query.next??0;
    const limit = req.query.limit;
    const sort = req.query.sort;

    // Construct SQL query
    let query = `
WITH transactions AS (
    SELECT
        s.contractId,
        SUM(CASE 
            WHEN s.timestamp >= strftime('%s', 'now', '-1 day') THEN CAST(s.price AS NUMERIC) 
            ELSE 0 
        END) AS vol24h,
        SUM(CASE 
            WHEN s.timestamp >= strftime('%s', 'now', '-7 days') THEN CAST(s.price AS NUMERIC) 
            ELSE 0 
        END) AS vol7d,
        SUM(CASE 
            WHEN s.timestamp >= strftime('%s', 'now', '-30 days') THEN CAST(s.price AS NUMERIC) 
            ELSE 0 
        END) AS vol30,
        SUM(CAST(s.price AS NUMERIC)) AS alltime
    FROM
        sales s
    GROUP BY
        s.contractId
),
floors AS (
    SELECT
        l.contractId,
        MIN(CAST(l.price AS NUMERIC)) AS floor
    FROM
        listings l
    WHERE
        l.delete_id IS NULL -- Exclude deleted listings
    GROUP BY
        l.contractId
),
approved_tokens AS (
    SELECT DISTINCT
        t.contractId
    FROM
        tokens t
    WHERE
        t.approved = 'C4NGXXA22RGBDDHVR4CXC6YPGYL4KC2RSCOKLOOBDR6IEKYSJYPJX3HJZE'
)
SELECT
    c.contractId,
    COALESCE(t.vol24h, 0) AS vol24h,
    COALESCE(t.vol7d, 0) AS vol7d,
    COALESCE(t.vol30, 0) AS vol30,
    COALESCE(t.alltime, 0) AS alltime,
    COALESCE(f.floor, 0) AS floor
FROM
    collections c
LEFT JOIN
    transactions t ON c.contractId = t.contractId
LEFT JOIN
    floors f ON c.contractId = f.contractId
INNER JOIN
    approved_tokens a ON c.contractId = a.contractId;
`;
    let conditions = [];
    let params = {};

    if (collectionId) {
        if (Array.isArray(collectionId)) {
            conditions.push(`c.contractId IN (${collectionId.map((_, i) => `$collectionId${i}`).join(',')})`);
            collectionId.forEach((c, i) => {
                params[`$collectionId${i}`] = c;
            });
        } else {
            conditions.push(`c.contractId = $collectionId`);
            params.$collectionId = collectionId;
        }
    }
    
    if (next) {
        conditions.push(`round >= $next`);
        params.$next = next;
    }

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    const allowedColumns = ['round'];

    if (sort) {
        let direction = 'ASC';
        let column = sort;

        // If the sort string starts with a hyphen, remove it and set direction to 'DESC'
        if (sort.startsWith('-')) {
            column = sort.substring(1);
            direction = 'DESC';
        }

        if (allowedColumns.includes(column)) {
            query += ` ORDER BY ${column} ${direction}`;
        } else {
            ` ORDER BY round ASC`;
        }
    } else {
        query += ` ORDER BY round ASC`;
    }

    if (limit) {
        query += ` LIMIT $limit`;
        params.$limit = limit;
    }

    // Execute query
    const rows = await db.all(query, params);

    // for all rows, change remove tokenIndex and change mintRound to mint-round
    for(let i = 0; i < rows.length; i++) {
        const row = rows[i];

        row.contractId = Number(row.contractId);
	row.vol24h = String(row.vol24h);
	row.vol7d = String(row.vol7d);
	row.vol30d = String(row.vol30d);
	row.alltime = String(row.alltime);
	row.floor = String(row.floor);
    }

    let mRound = 0;
    if (rows.length > 0) {
        mRound = rows[rows.length-1].round;
    }

    response.volumes = rows
    response['next-token'] = mRound+1;
    res.status(200).json(response);

    // Log date/time, ip address, query
    const date = new Date();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`);
}
