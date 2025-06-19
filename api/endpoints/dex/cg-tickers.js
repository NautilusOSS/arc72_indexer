import BigNumber from "bignumber.js";

function calculateDepthFromReserves({
  baseReserve,
  quoteReserve,
  depthPercent = 2 // percent depth, e.g. 2 = ±2%
}) {
  const normalize = (value, decimals) => Number(value)

  const x = baseReserve;
  const y = quoteReserve;
  const price = y / x;

  const multiplierUp = 1 + depthPercent / 100;
  const multiplierDown = 1 - depthPercent / 100;

  // +depth% price target
  const priceUp = price * multiplierUp;
  const deltaXBuy = x - (y / priceUp);
  const quoteSpent = (x * y) / (x - deltaXBuy) - y;

  // -depth% price target
  const priceDown = price * multiplierDown;
  const deltaXSell = (y / priceDown) - x;
  const quoteReceived = y - (x * y) / (x + deltaXSell);

  return {
    lastPrice: price,
    [`plus${depthPercent}PercentDepth`]: {
      base: deltaXBuy,
      quote: quoteSpent
    },
    [`minus${depthPercent}PercentDepth`]: {
      base: deltaXSell,
      quote: quoteReceived
    }
  };
}

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
 * /nft-indexer/v1/dex/integration/coingecko/tickers:
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

export const coingeckoTickerEndpoint = async (req, res, db) => {
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


  const aUSD_VOI = 395553;
  const oracle = await db.get(`select * from dex_pool where contractId = ? ;`, [395553]) ?? null;
  const rate = new BigNumber(oracle.poolBalA).div(new BigNumber(oracle.poolBalB))
 

  // Extract query parameters

  // Sanitize input to prevent SQL injection

  // Construct SQL query

  let query = "";
  let conditions = [];
  let params = {};
 
    query += `
SELECT 
    p.*,
    pA.price AS tokAPrice,
    pB.price AS tokBPrice,
    cA.decimals AS tokADecimals,
    cB.decimals AS tokBDecimals,
    CASE
        WHEN CAST(tvlA AS REAL) < CAST(tvlB AS REAL) THEN CAST(tvlA AS REAL) * 2
        ELSE CAST(tvlB AS REAL) * 2
    END AS tvl,
    c.createRound AS createRound,
    c.creator AS creator,
    
    -- 24h Volume Normalized
    (
        SELECT SUM(CAST(inBalA AS REAL)) / POW(10, cA.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 86400
    ) AS volA,
    (
        SELECT SUM(CAST(inBalB AS REAL)) / POW(10, cB.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 86400
    ) AS volB,
    -- 7d Volume Normalized
    (
        SELECT SUM(CAST(inBalA AS REAL)) / POW(10, cA.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 604800
    ) AS volA7d,
    (
        SELECT SUM(CAST(inBalB AS REAL)) / POW(10, cB.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 604800
    ) AS volB7d,
    -- 30d Volume Normalized
    (
        SELECT SUM(CAST(inBalA AS REAL)) / POW(10, cA.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 2592000
    ) AS volA30d,
    (
        SELECT SUM(CAST(inBalB AS REAL)) / POW(10, cB.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 2592000
    ) AS volB30d,
    -- 1y Volume Normalized
    (
        SELECT SUM(CAST(inBalA AS REAL)) / POW(10, cA.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 31556952
    ) AS volA1y,
    (
        SELECT SUM(CAST(inBalB AS REAL)) / POW(10, cB.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 31556952
    ) AS volB1y,
    -- Alltime Volume Normalized
    (
        SELECT SUM(CAST(inBalA AS REAL)) / POW(10, cA.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId
    ) AS volAAll,
    (
        SELECT SUM(CAST(inBalB AS REAL)) / POW(10, cB.decimals)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId
    ) AS volBAll,
    -- Latest swap timestamp
    (
        SELECT MAX(s.timestamp)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId
    ) AS latestSwap,
    -- High price over 24h: 1 base = X target
    (
        SELECT MAX(
            (CAST(poolBalB AS REAL) * POW(10, cA.decimals)) / 
            NULLIF(CAST(poolBalA AS REAL) * POW(10, cB.decimals), 0)
        )
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 86400
    ) AS highPrice,

    -- Low price over 24h: 1 base = X target
    (
        SELECT MIN(
            (CAST(poolBalB AS REAL) * POW(10, cA.decimals)) / 
            NULLIF(CAST(poolBalA AS REAL) * POW(10, cB.decimals), 0)
        )
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId AND s.timestamp >= strftime('%s', 'now') - 86400
    ) AS lowPrice,

    -- Last price (most recent swap): 1 base = X target
    (
        SELECT 
            (CAST(inBalB AS REAL) * POW(10, cA.decimals)) / 
            NULLIF(CAST(inBalA AS REAL) * POW(10, cB.decimals), 0)
        FROM event_dex_swaps s
        WHERE s.contractId = p.contractId
        ORDER BY s.timestamp DESC
        LIMIT 1
    ) AS lastPrice

FROM 
    dex_pool p
INNER JOIN 
    contracts_0200 c ON p.contractId = c.contractId
INNER JOIN 
    contracts_0200 cA ON p.tokAId = cA.contractId
INNER JOIN 
    contracts_0200 cB ON p.tokBId = cB.contractId
INNER JOIN 
    prices_0200 pA ON p.tokAId = pA.contractId
INNER JOIN 
    prices_0200 pB ON p.tokBId = pB.contractId;
    `;

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(" AND ");
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
  res.status(200).json(rows.map(r => {

    const baseCurrencyId = `${r.tokAId === '390001' ? '0' : r.tokAId}`;
    const targetCurrencyId = `${r.tokBId === '390001' ? '0' : r.tokBId}`;
    const ticketId = `${baseCurrencyId}_${targetCurrencyId}`;
    const lastPrice = `${new BigNumber(r.poolBalB).div(new BigNumber(r.poolBalA))}`;
    const baseVolumeNormal = `${new BigNumber(r.volA).plus(new BigNumber(r.volB).div(new BigNumber(lastPrice)))}`;
    const targetVolumeNormal = `${new BigNumber(r.volA).multipliedBy(lastPrice).plus(new BigNumber(r.volB))}`;
    //const baseVolumeNormal = `${r.volA ? new BigNumber(r.volA) : new BigNumber(0)}`;
    //const targetVolumeNormal = `${r.volB ? new BigNumber(r.volB) : new BigNumber(0)}`;
    const baseVolumeNormal7d = `${r.volA7d ? new BigNumber(r.volA7d).plus(new BigNumber(r.volB7d).div(new BigNumber(lastPrice))) : new BigNumber(0)}`;
    const targetVolumeNormal7d = `${r.volB7d ? new BigNumber(r.volA7d).multipliedBy(lastPrice).plus(new BigNumber(r.volB7d)) : new BigNumber(0)}`;
    const baseVolumeNormal30d = `${r.volA30d ? new BigNumber(r.volA30d).plus(new BigNumber(r.volB30d).div(new BigNumber(lastPrice))) : new BigNumber(0)}`;
    const targetVolumeNormal30d = `${r.volB30d ? new BigNumber(r.volA30d).multipliedBy(lastPrice).plus(new BigNumber(r.volB30d)) : new BigNumber(0)}`;
    const baseVolumeNormal1y = `${r.volA1y ? new BigNumber(r.volA1y).plus(new BigNumber(r.volB1y).div(new BigNumber(lastPrice))) : new BigNumber(0)}`;
    const targetVolumeNormal1y = `${r.volB1y ? new BigNumber(r.volA1y).multipliedBy(lastPrice).plus(new BigNumber(r.volB1y)) : new BigNumber(0)}`;
    const baseVolumeNormalAll = `${r.volAAll ? new BigNumber(r.volAAll).plus(new BigNumber(r.volBAll).div(new BigNumber(lastPrice))) : new BigNumber(0)}`;
    const targetVolumeNormalAll = `${r.volBAll ? new BigNumber(r.volAAll).multipliedBy(lastPrice).plus(new BigNumber(r.volBAll)) : new BigNumber(0)}`;
    const basePrice = `${r.tokAPrice}`;
    const targetPrice = `${r.tokBPrice}`;

	
    const liquidityUSD = `${rate.multipliedBy(r.tvl)}`;

    return ({
    	"ticker_id": `${ticketId}`,
    	"base_currency": `${r.symbolA}`,
    	"base_currency_id": `${baseCurrencyId}`,
    	"target_currency": `${r.symbolB}`,
    	"target_currency_id": `${targetCurrencyId}`,
    	"pool_id": `${r.contractId}`,
    	"last_price": `${lastPrice}`,
    	"base_volume": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:baseVolumeNormal}`, 
    	"target_volume": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:targetVolumeNormal}`, 
    	"liquidity_in_usd": `${liquidityUSD}`,
    	"update_datetime": `${formatToCustomISO(r.latestSwap) || formatToCustomISO(Date.now() / 1000)}`,
	"high": `${r.highPrice || lastPrice}`,
	"low": `${r.lowPrice || lastPrice}`,
	// checking that volumes match
    	//"base_volume_voi": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:new BigNumber(baseVolumeNormal).multipliedBy(new BigNumber(basePrice))}`, 
    	//"target_volume_voi": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:new BigNumber(targetVolumeNormal).multipliedBy(new BigNumber(targetPrice))}`, 
	// extra fields
    	"base_volume_24h": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:baseVolumeNormal}`, 
    	"target_volume_24h": `${isNaN(baseVolumeNormal)||isNaN(targetVolumeNormal)?0:targetVolumeNormal}`, 
    	"base_volume_7d": `${baseVolumeNormal7d}`, 
    	"target_volume_7d": `${targetVolumeNormal7d}`, 
    	"base_volume_30d": `${baseVolumeNormal30d}`, 
    	"target_volume_30d": `${targetVolumeNormal30d}`, 
    	"base_volume_1y": `${baseVolumeNormal1y}`, 
    	"target_volume_1y": `${targetVolumeNormal1y}`, 
    	"base_volume_all": `${baseVolumeNormalAll}`, 
    	"target_volume_all": `${targetVolumeNormalAll}`, 
	"base_price": `${basePrice}`,
	"target_price": `${targetPrice}`
    })
  }));

  // Log date/time, ip address, query
  const date = new Date();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.error(
    `${date.toISOString()}: ${ip} ${query} ${JSON.stringify(params)}`
  );
};
