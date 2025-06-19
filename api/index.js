import express from "express";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import https from "https";
import path from "path";
import { swaggerOptions } from "./swagger.js";
import minimist from "minimist"; // import minimist to parse command line arguments
import fs from "fs";
import Database from "./database.js";
import { tokensEndpoint } from "./endpoints/arc72/tokens.js";
import { transfersEndpoint } from "./endpoints/arc72/transfers.js";
import { collectionsEndpoint } from "./endpoints/arc72/collections.js";
import { marketsEndpoint } from "./endpoints/mp/markets.js";
import { listingsEndpoint } from "./endpoints/mp/listings.js";
import { offersEndpoint } from "./endpoints/mp/offers.js";
import { salesEndpoint } from "./endpoints/mp/sales.js";
import { saleVolumesEndpoint } from "./endpoints/mp/volumes.js";
import { mpStatsEndpoint } from "./endpoints/mp/stats.js";
import { deletesEndpoint } from "./endpoints/mp/deletes.js";
import { statsEndpoint } from "./endpoints/stats.js";
import { contracts0200Endpoint } from "./endpoints/arc200/tokens.js";
import { accounts0200Endpoint } from "./endpoints/arc200/balances.js";
import { prices0200Endpoint } from "./endpoints/arc200/prices.js";
import { arc200TransfersEndpoint } from "./endpoints/arc200/transfers.js";
import { approvals0200Endpoint } from "./endpoints/arc200/approvals.js";
import { arc200TokenStubEndpoint } from "./endpoints/arc200/stubs.js";
import { stats0200WVoiEndpoint } from "./endpoints/arc200/stats-wvoi.js";
import { coingeckoTickerEndpoint } from "./endpoints/dex/cg-tickers.js";
import { coingeckoHistoricalTradesEndpoint } from "./endpoints/dex/cg-historical-trades.js";
import { dexPoolsEndpoint } from "./endpoints/dex/pools.js";
import { dexSwapsEndpoint } from "./endpoints/dex/swaps.js";
import { dexPricesEndpoint } from "./endpoints/dex/prices.js";
import { dexPoolStubEndpoint } from "./endpoints/dex/stubs.js";
import { stakePoolsEndpoint } from "./endpoints/stake/pools.js";
import { stakeAccountsEndpoint } from "./endpoints/stake/accounts.js";
import { scsAccountsEndpoint } from "./endpoints/scs/accounts.js";
import dotenv from "dotenv";
dotenv.config();

const DB_PATH = process.env.DB_PATH || "../db/db.sqlite";
const db = new Database(DB_PATH);

const app = express();

const args = minimist(process.argv.slice(2));

const port = args.p || process.env.API_SERVER_PORT || 3000;

// Serve .well-known and openapi.yaml as static files for OpenAI plugin discovery
const wellKnownPath = path.join(process.cwd(), ".well-known");
const openapiPath = path.join(process.cwd(), "openapi.yaml");

console.log("Static file paths:");
console.log("Well-known path:", wellKnownPath);
console.log("OpenAPI path:", openapiPath);

app.use(
  "/.well-known",
  express.static(wellKnownPath)
);
app.use(
  "/openapi.yaml",
  express.static(openapiPath)
);

const endpoints = [
  {
    path: "/nft-indexer/v1/tokens",
    handler: tokensEndpoint,
  },
  {
    path: "/nft-indexer/v1/transfers",
    handler: transfersEndpoint,
  },
  {
    path: "/nft-indexer/v1/collections",
    handler: collectionsEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/markets",
    handler: marketsEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/listings",
    handler: listingsEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/offers",
    handler: offersEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/sales",
    handler: salesEndpoint,
  }, 
  {
    path: "/nft-indexer/v1/mp/volumes",
    handler: saleVolumesEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/stats",
    handler: mpStatsEndpoint,
  },
  {
    path: "/nft-indexer/v1/mp/deletes",
    handler: deletesEndpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/tokens",
    handler: contracts0200Endpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/balances",
    handler: accounts0200Endpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/approvals",
    handler: approvals0200Endpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/prices",
    handler: prices0200Endpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/stubs/token",
    handler: arc200TokenStubEndpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/stats/wvoi",
    handler: stats0200WVoiEndpoint,
  },
  {
    path: "/nft-indexer/v1/arc200/transfers",
    handler: arc200TransfersEndpoint,
  },
  {
    path: "/integrations/coingecko/tickers",
    handler: coingeckoTickerEndpoint,
  },
  {
    path: "/integrations/coingecko/historical_trades",
    handler: coingeckoHistoricalTradesEndpoint, 
  },
  {
    path: "/integrations/coingecko/historical",
    handler: coingeckoHistoricalTradesEndpoint,
  },
  {
    path: "/nft-indexer/v1/dex/pools",
    handler: dexPoolsEndpoint,
  },
  {
    path: "/nft-indexer/v1/dex/swaps",
    handler: dexSwapsEndpoint,
  },
  {
    path: "/nft-indexer/v1/dex/prices",
    handler: dexPricesEndpoint,
  },
  {
    path: "/nft-indexer/v1/dex/stubs/pool",
    handler: dexPoolStubEndpoint,
  },
  {
    path: "/nft-indexer/v1/stake/pools",
    handler: stakePoolsEndpoint,
  },
  {
    path: "/nft-indexer/v1/stake/accounts",
    handler: stakeAccountsEndpoint,
  },
  {
    path: "/v1/scs/accounts",
    handler: scsAccountsEndpoint,
  },
  {
    path: "/stats",
    handler: statsEndpoint,
  },
];

// populate swaggerOptions version with the version from package.json, read file
const packageJson = JSON.parse(fs.readFileSync("../package.json", "utf8"));
swaggerOptions.swaggerDefinition.info.version = packageJson.version;

swaggerOptions.swaggerDefinition.servers.push({
  url: `http://localhost:${port}`,
  description: "Local Server",
});

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// listen to all endpoints defined in endpoints array
endpoints.forEach((endpoint) => {
  app.get(endpoint.path, (req, res) => endpoint.handler(req, res, db));
});

// Start the server

if (!args.https) {
  app.listen(port, () => {
    console.log(`Indexer API Server listening at http://localhost:${port}`);
    console.log(`API Docs: http://localhost:${port}/api-docs`);
    console.log(`OpenAI Plugin Manifest: http://localhost:${port}/.well-known/ai-plugin.json`);
    console.log(`OpenAPI Spec: http://localhost:${port}/openapi.yaml`);
    console.log(
      `Tokens Endpoint: http://localhost:${port}/nft-indexer/v1/tokens`
    );
    console.log(
      `Transfers Endpoint: http://localhost:${port}/nft-indexer/v1/transfers`
    );
  });
} else {
  const redirectApp = express();
  const redirectUrl = "https://arc72-idx.nautilus.sh";
  redirectApp.get("*", (req, res) => {
    const redirectTo = redirectUrl + req.originalUrl;
    res.redirect(redirectTo);
  });
  redirectApp.listen(80, () => {
    console.log(`Server is running on port 80`);
  });
  https
    .createServer(
      {
        key: fs.readFileSync(process.env.HTTPS_KEY),
        cert: fs.readFileSync(process.env.HTTPS_CERT),
        ca: fs.readFileSync(process.env.HTTPS_CA),
      },
      app
    )
    .listen(443, () => {
      console.log(`Listening on port 443...`);
    });
}
