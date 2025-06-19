export const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "ARC-72 NFT Indexer API",
      description: `<p>This is an API for accessing ARC-72 NFT data based on the ARC-74 indexer specification at 
                      <a href="https://arc.algorand.foundation/ARCs/arc-0074" target="_blank">https://arc.algorand.foundation/ARCs/arc-0074</a>.
                      The endpoints described below are under active development and may change without notice.
                      Data is provided for informational purposes only and may not be accurate or complete. Use at your own risk.</p>
                      <p>Note: The current prototype server points to the VOI TestNet Network.</p>
                      <p>The full source and additional links are available at 
                      <a href="https://github.com/xarmian/arc72_indexer" target="_blank">https://github.com/xarmian/arc72_indexer</a>.</p>
                      <p>A reference application is available at <a href="https://nftnavigator.xyz">https://nftnavigator.xyz</a> with source
                      available at <a href="https://github.com/xarmian/nft_navigator">https://github.com/xarmian/nft_navigator</a></p>`,
    },
    servers: [
      {
        url: "https://mainnet-idx.nautilus.sh",
        description: "Mainnet Server",
      },
    ],
    components: {
      schemas: {
        Token: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "The current owner of the NFT.",
            },
            approved: {
              type: "string",
              description: "The address that is approved to transfer the NFT.",
            },
            contractId: {
              type: "integer",
              description:
                "The ID of the ARC-72 contract that defines the NFT.",
            },
            tokenId: {
              type: "integer",
              description:
                "The tokenID of the NFT, which along with the contractId addresses a unique ARC-72 token.",
            },
            mintRound: {
              type: "integer",
              description: "The round at which the NFT was minted.",
            },
            metadataURI: {
              type: "string",
              description:
                "The URI given for the token by the metadataURI API of the contract.",
            },
            metadata: {
              type: "string",
              description: "The cached metadata of the NFT, should be JSON.",
            },
          },
        },
        Transfer: {
          type: "object",
          properties: {
            contractId: {
              type: "string",
              description:
                "The ID of the ARC-72 contract that defines the NFT.",
            },
            tokenId: {
              type: "string",
              description:
                "The tokenID of the NFT, which along with the contractId addresses a unique ARC-72 token.",
            },
            from: {
              type: "string",
              description: "The sender of the transaction.",
            },
            to: {
              type: "string",
              description: "The receiver of the transaction.",
            },
            round: {
              type: "integer",
              description: "The round of the transfer.",
            },
            transactionId: {
              type: "string",
              description: "The unique identifier of the transaction.",
            },
            timestamp: {
              type: "integer",
              format: "int64",
              description: "Timestamp of the transaction.",
            },
          },
        },
        Collection: {
          type: "object",
          properties: {
            contractId: {
              type: "string",
              description:
                "The ID of the ARC-72 contract that defines the NFT collection.",
            },
            totalSupply: {
              type: "integer",
              description: "The total number of tokens minted by the contract.",
            },
            mintRound: {
              type: "integer",
              description:
                "The round at which the NFT collection contract was created.",
            },
            firstToken: {
              $ref: "#/components/schemas/Token",
              description:
                "The first token in the collection, null if the collection is empty.",
            },
            globalState: {
              type: "array",
              description: "Array of global state key-value pairs",
            },
            isBlacklisted: {
              type: "boolean",
              description: "Whether the collection is blacklisted.",
            },
            creator: {
              type: "string",
              description: "The address of the creator of the collection.",
            },
          },
        },
        Listing: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "The transaction ID of the listing",
            },
            mpContractId: {
              type: "string",
              description: "The ID of a Marketplace contract",
            },
            mpListingId: {
              type: "string",
              description: "The ID of a listing in the marketplace",
            },
            collectionId: {
              type: "string",
              description: "The contract ID of the collection being listed",
            },
            tokenId: {
              type: "string",
              description: "The ID of the token being listed",
            },
            seller: {
              type: "string",
              description: "The address of the seller",
            },
            escrowAddr: {
              type: "string",
              description: "The escrow address of the marketplace contract",
            },
            price: {
              type: "integer",
              description: "The price of the listing",
            },
            currency: {
              type: "string",
              description:
                "The currency of the listing, 0 = Native Token, otherwise ASA or ARC-200 token ID",
            },
            createRound: {
              type: "integer",
              description: "The round the listing was created",
            },
            createTimestamp: {
              type: "integer",
              description: "The timestamp when the listing was created",
            },
            royalty: {
              type: "integer",
              description: "The royalty for the listing",
            },
            token: {
              $ref: "#/components/schemas/Token",
              description: "The token being listed",
            },
          },
        },
        Sale: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "The transaction ID of the sale",
            },
            mpContractId: {
              type: "string",
              description: "The ID of a Marketplace contract",
            },
            mpListingId: {
              type: "string",
              description: "The ID of a listing in the marketplace",
            },
            collectionId: {
              type: "string",
              description: "The contract ID of the collection being sold",
            },
            tokenId: {
              type: "string",
              description: "The ID of the token being sold",
            },
            seller: {
              type: "string",
              description: "The address of the seller",
            },
            buyer: {
              type: "string",
              description: "The address of the buyer",
            },
            price: {
              type: "integer",
              description: "The price of the sale",
            },
            currency: {
              type: "string",
              description:
                "The currency of the sale, 0 = Native Token, otherwise ASA or ARC-200 token ID",
            },
            round: {
              type: "integer",
              description: "The round of the sale",
            },
            createTimestamp: {
              type: "integer",
              description: "The timestamp of the sale",
            },
            listing: {
              $ref: "#/components/schemas/Listing",
              description: "The listing of the sale",
            },
          },
        },
        ARC200Approval: {
          type: "object",
          properties: {
            contractId: {
              type: "integer",
              description: "The ID of the ARC-200 contract",
            },
            owner: {
              type: "string",
              description: "The address of the token owner",
            },
            spender: {
              type: "string",
              description: "The address approved to spend tokens",
            },
            amount: {
              type: "string",
              description: "The amount approved for spending",
            },
            mintRound: {
              type: "integer",
              description: "The round when the approval was created",
            },
          },
        },
        ARC200Transfer: {
          type: "object",
          properties: {
            contractId: {
              type: "integer",
              description: "The ID of the ARC-200 contract",
            },
            sender: {
              type: "string",
              description: "The address of the sender",
            },
            receiver: {
              type: "string",
              description: "The address of the receiver",
            },
            amount: {
              type: "string",
              description: "The amount transferred",
            },
            round: {
              type: "integer",
              description: "The round of the transfer",
            },
            timestamp: {
              type: "integer",
              description: "Timestamp of the transfer",
            },
          },
        },
        DEXPool: {
          type: "object",
          properties: {
            contractId: {
              type: "integer",
              description: "The ID of the DEX pool contract",
            },
            tokAId: {
              type: "integer",
              description: "The ID of token A in the pool",
            },
            tokBId: {
              type: "integer",
              description: "The ID of token B in the pool",
            },
            tokADecimals: {
              type: "integer",
              description: "The decimals of token A",
            },
            tokBDecimals: {
              type: "integer",
              description: "The decimals of token B",
            },
            tvl: {
              type: "number",
              description: "Total Value Locked in the pool",
            },
            createRound: {
              type: "integer",
              description: "The round when the pool was created",
            },
            creator: {
              type: "string",
              description: "The address of the pool creator",
            },
          },
        },
        StakeAccount: {
          type: "object",
          properties: {
            contractId: {
              type: "integer",
              description: "The ID of the staking contract",
            },
            poolId: {
              type: "integer",
              description: "The ID of the staking pool",
            },
            accountId: {
              type: "string",
              description: "The address of the staking account",
            },
            userStakeAmount: {
              type: "string",
              description: "The amount staked by the user",
            },
            providerAccountId: {
              type: "string",
              description: "The address of the pool provider",
            },
            stakeTokenId: {
              type: "integer",
              description: "The ID of the staking token",
            },
            allStakeAmount: {
              type: "string",
              description: "The total amount staked in the pool",
            },
            start: {
              type: "integer",
              description: "The start round of the staking period",
            },
            end: {
              type: "integer",
              description: "The end round of the staking period",
            },
            createRound: {
              type: "integer",
              description: "The round when the stake was created",
            },
            rewardTokenIds: {
              type: "string",
              description: "Comma-separated list of reward token IDs",
            },
            rewardAmounts: {
              type: "string",
              description: "Comma-separated list of reward amounts",
            },
            rewardRemainings: {
              type: "string",
              description: "Comma-separated list of remaining rewards",
            },
            stakeOwnershipPercentage: {
              type: "number",
              description: "The percentage of the pool owned by the user",
            },
            maxUserRewardRemaining: {
              type: "number",
              description: "The maximum remaining reward for the user",
            },
          },
        },
        StakePool: {
          type: "object",
          properties: {
            contractId: {
              type: "integer",
              description: "The ID of the staking contract",
            },
            poolId: {
              type: "integer",
              description: "The ID of the staking pool",
            },
            providerAccountId: {
              type: "string",
              description: "The address of the pool provider",
            },
            stakeTokenId: {
              type: "integer",
              description: "The ID of the staking token",
            },
            stakedAmount: {
              type: "string",
              description: "The total amount staked in the pool",
            },
            start: {
              type: "integer",
              description: "The start round of the staking period",
            },
            end: {
              type: "integer",
              description: "The end round of the staking period",
            },
            createRound: {
              type: "integer",
              description: "The round when the pool was created",
            },
            rewardTokenIds: {
              type: "string",
              description: "Comma-separated list of reward token IDs",
            },
            rewardAmounts: {
              type: "string",
              description: "Comma-separated list of reward amounts",
            },
            rewardRemainings: {
              type: "string",
              description: "Comma-separated list of remaining rewards",
            },
          },
        },
      },
    },
  },
  apis: [
    "./endpoints/arc72/tokens.js",
    "./endpoints/arc72/transfers.js",
    "./endpoints/arc72/collections.js",
    "./endpoints/mp/listings.js",
    "./endpoints/mp/sales.js",
    "./endpoints/mp/deletes.js",
    "./endpoints/arc200/tokens.js",
    "./endpoints/arc200/balances.js",
    "./endpoints/arc200/approvals.js",
    "./endpoints/arc200/transfers.js",
    "./endpoints/arc200/prices.js",
    "./endpoints/scs/accounts.js",
    "./endpoints/dex/pools.js",
    "./endpoints/dex/swaps.js",
    "./endpoints/dex/cg-tickers.js",
    "./endpoints/dex/cg-historical-trades.js",
    "./endpoints/dex/prices.js",
    "./endpoints/stake/accounts.js",
    "./endpoints/stake/pools.js",
    "./endpoints/stats.js",
  ],
};
