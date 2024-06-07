import algosdk from "algosdk";
import readline from "readline";
import { CONTRACT, abi, swap } from "ulujs";
import {
    CONTRACT_TYPE_UNKNOWN,
    CONTRACT_TYPE_ARC72,
    CONTRACT_TYPE_ARC200,
    CONTRACT_TYPE_MP,
    CONTRACT_TYPE_LPT,
} from "./constants.js";
import Database from "./database.js";
import dotenv from "dotenv";
dotenv.config();

const {
    ALGOD_TOKEN = "",
    ALGOD_HOST = "https://testnet-api.voi.nodly.io",
    ALGOD_PORT = "443",

    INDEXER_TOKEN = "",
    INDEXER_HOST = "https://testnet-idx.voi.nodly.io",
    INDEXER_PORT = "443",
} = process.env;

export const algodClient = new algosdk.Algodv2(
    { "X-Algo-API-Token": ALGOD_TOKEN },
    ALGOD_HOST,
    ALGOD_PORT
);
export const indexerClient = new algosdk.Indexer(
    INDEXER_TOKEN,
    INDEXER_HOST,
    INDEXER_PORT
);

const DB_PATH = process.env.DB_PATH || "../db/db.sqlite";

export const db = new Database(DB_PATH);

export const trim = (str) => str.replace(/\0/g, "");

export const prepareString = (str) => {
  const index = str.indexOf("\x00");
  if (index > 0) {
    return str.slice(0, str.indexOf("\x00"));
  } else {
    return str;
  }
};

// function to convert hex to bytes, modeled after ethers arrayify function
export function bytesFromHex(hex) {
    hex = hex.replace(/^0x/i, "");
    hex = hex.length % 2 ? "0" + hex : hex;
    return Buffer.from(hex, "hex");
}

const INTERFACE_SELECTOR_ARC72 = "0x4e22a3ba";
const INTERFACE_SELECTOR_MP = "0xae4d14ad";
const INTERFACE_SELECTOR_ARC200 = "0xc7bea040";

async function isSupported(contractId, interfaceSelector) {
    try {
	const makeABI = (method) => ({
            name: "",
            desc: "",
            methods: [method],
            events: [],
        })
        const ci = new CONTRACT(contractId, algodClient, indexerClient, makeABI(
                {
                    name: "supportsInterface",
                    args: [{ type: "byte[4]" }],
                    returns: { type: "bool" },
                    readonly: true,
                }
	))
	const ci2 = new CONTRACT(contractId, algodClient, indexerClient, makeABI(
        	{
                    name: "supportsInterface",
                    args: [{ type: "byte[4]" }],
                    returns: { type: "byte" },
                    readonly: true,
                }
        ))
        const sim = await ci.supportsInterface(bytesFromHex(interfaceSelector));
        const sim2 = await ci2.supportsInterface(bytesFromHex(interfaceSelector));
        if (sim.success || sim2.success) {
            return sim.returnValue;
        }
        return false;
    } catch (err) {
        return false;
    }
}

export async function isARC72(contractId) {
    return isSupported(contractId, INTERFACE_SELECTOR_ARC72);
}

export async function isMP(contractId) {
    return isSupported(contractId, INTERFACE_SELECTOR_MP);
}

export async function isARC200(contractId) {
     //const res2 = await isSupported(contractId, INTERFACE_SELECTOR_ARC200);
     //console.log(res2)
     try {
         const ci = new CONTRACT(contractId, algodClient, indexerClient, abi.arc200);
         const res = await ci.arc200_name();
         if (res.success) {
             return true;
         }
         return false;
     } catch (err) {
         console.log(err);
         return false;
     }
}

export async function isLPT(contractId) {
  const accountAssets = await indexerClient.lookupAccountAssets(algosdk.getApplicationAddress(contractId)).do();
  const app = await indexerClient.lookupApplications(contractId).do();
  const appGlobalState = app.application.params["global-state"];
  const ciSwap = new swap(contractId, algodClient, indexerClient)
  const infoR = await ciSwap.Info();
  const isARC200LT = infoR.success;
  const isLPT = appGlobalState.find(el => el.key === "cmF0aW8=" /*ratio*/) && accountAssets.assets.length === 0;
  if(isARC200LT || isLPT) return true;
  return false;
}

// TODO support multiple contract types
//      for example if what-if a contract is an arc72 and an arc200
export async function getContractType(contract) {
    if (await isARC72(contract)) return CONTRACT_TYPE_ARC72;
    else if (await isMP(contract)) return CONTRACT_TYPE_MP;
    else if (await isARC200(contract)) {
        if(await isLPT(contract)) {
            return CONTRACT_TYPE_LPT;
        }
        return CONTRACT_TYPE_ARC200;
    }
    return CONTRACT_TYPE_UNKNOWN;
}

export async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function output(msg, clear = false) {
    if (process.env.DOCKER_MODE && process.env.DOCKER_MODE === "true") {
        console.log(msg);
    } else {
        if (clear) {
            readline.clearLine(process.stdout, 0);
        }
        process.stdout.write(msg);
    }
}

// return all app ids involved in a block of transactions (blk.block.txns)
export function getAllAppIds(txns) {
    let apps = [];
    if (txns === undefined) return apps;
    for (const t of txns) {
        if (t.apid || t.txn?.apid) {
            apps.push({
                apid: t.apid ?? t.txn.apid,
                isCreate: t.txn.apap && t.txn.apsu ? true : false,
            });
        }
        if (t.dt?.itx) apps = apps.concat(getAllAppIds(t.dt.itx));
    }
    return apps;
}

export function getAllAppIdsIdx(txns) {
    let apps = [];
    if (txns === undefined) return apps;
    for (const t of txns) {
        if (t["created-application-index"]) {
            apps.push({
                apid: t["created-application-index"],
                isCreate: true,
            });
        } else if (t["application-transaction"]) {
            apps.push({
                apid: t["application-transaction"]["application-id"],
                isCreate: t["on-completion"] === 0 ? true : false,
            });
        }
        if (t["inner-txns"]) apps = apps.concat(getAllAppIdsIdx(t["inner-txns"]));
    }

    // return array of unique apps objects { apid: number, isCreate: boolean }
    return apps.filter((v, i, a) => a.findIndex((t) => t.apid === v.apid) === i);
}

export const decodeGlobalState = (globalState) => {
    const decodedState = globalState.map((state) => {
        const key = Buffer.from(state.key, "base64").toString(); // Decode key from base64
        let value;

        if (state.value.type === 1) {
            // first see if it's a valid address
            const b = new Uint8Array(Buffer.from(state.value.bytes, "base64"));
            value = algosdk.encodeAddress(b);

            // then decode as string
            if (!algosdk.isValidAddress(value)) {
                value = Buffer.from(state.value.bytes, "base64").toString();
            }
        } else if (state.value.type === 2) {
            // Check if the type is uint
            value = state.value.uint;
        }

        return { key, value };
    });

    return decodedState;
};

export const decodeMpCurrencyData = (currencyData) => {
    const ct = currencyData[0];
    const currency = ct == "00" ? 0 : parseInt(currencyData[1], 16);
    const price =
        ct == "00" ? Number(currencyData[1]) : parseInt(currencyData[2], 16);
    return { currency, price };
};
