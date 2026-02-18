const bs58 = require("bs58");

const {
  bundle: { Bundle },
} = require("jito-ts");
const axios = require("axios");
const {
  Keypair,
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { useConnection, getSimulateMode, simulateTxs } = require("./connection");
const { searcherClient } = require("jito-ts/dist/sdk/block-engine/searcher");

const JITO_TIMEOUT = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

var tipAddrs = [];

exports.getTipAccounts = async () => {
  try {
    const { data } = await axios.post(
      `https://${process.env.JITO_MAINNET_URL}/api/v1/bundles`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getTipAccounts",
        params: [],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return data.result;
  } catch (err) {
    console.log(err);
  }
  return [];
};

exports.getTipAccountsWithSDK = async (client) => {
  try {
    return client.getTipAccounts();
  } catch (err) {
    console.log(err);
    return [];
  }
};

const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 0.999)) + min;
};

exports.CreateJitoTipInstruction = (
    senderAddress,
    tipAmount
) => {
    const jitoTipAccounts = [
      "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
      "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
      "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
      "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
      "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
      "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
      "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
      "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    ];

    const index = getRandomNumber(0, jitoTipAccounts.length-1);
    console.log("index", index);
    const tipAddress = new PublicKey(jitoTipAccounts[index])
    return SystemProgram.transfer({
        fromPubkey: senderAddress,
        toPubkey: tipAddress,
        lamports: tipAmount,
    })
}

exports.getTipTrx = async (tipPayer, tip = 0.002) => {
  try {
    const { tipAddrs } = this.useJitoTipAddr();
    const tipAddr = tipAddrs[getRandomNumber(0, tipAddrs.length - 1)];
    const tipAccount = new PublicKey(tipAddr);

    const tipTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tipPayer.publicKey,
        toPubkey: tipAccount,
        lamports: LAMPORTS_PER_SOL * tip,
      })
    );
    const SOLANA_CONNECTION = new Connection(process.env.SOLANA_RPC_URL);

    tipTx.recentBlockhash = (
      await SOLANA_CONNECTION.getLatestBlockhash("finalized")
    ).blockhash;
    tipTx.sign(tipPayer);

    return tipTx;
  } catch (err) {
    console.log(err);
  }
  return null;
};

const confirmJitoTransaction = async (connection, signature, latestBlockhash, timeOutDelay) => {
  console.log('Confirming jito transaction...');

  // Create confirmation promise
  const confirmation = connection.confirmTransaction(
    {
      signature: signature,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      blockhash: latestBlockhash.blockhash,
    },
    'confirmed'
  );

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Transaction confirmation timed out')), timeOutDelay)
  );

  try {
    // Wait for confirmation or timeout
    const confirmationResult = await Promise.race([confirmation, timeoutPromise]);

    if (!confirmationResult.value.err) {
      console.log('signature', signature);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error during transaction confirmation:', error);
    return false;
  }
}

exports.jitoWithSearcher = async (transactions, latestBlockhash, connection) => {
  try {
    console.log(
      `Starting Jito transaction execution... transaction count: ${transactions.length}`
    );

    const jitoTxsignature = bs58.encode(transactions[0].signatures[0]);
    const serializedTransactions = [];
   
    // simulation before sending bundle
    const signatures = [];
    const txSizes = [];

    for (let i = 0; i < transactions.length; i++) {
      signatures.push(bs58.encode(transactions[i].signatures[0]));
      txSizes.push(transactions[i].serialize().length);
    }

    txSizes.map((txSize, i) => {
      console.log(`tx size: ${i + 1} => ${txSize}`);
    });
    console.log("signatures");
    console.log(signatures);

    // Simulate bundle
    if (geSimulateMode()) {
        const simultationResult = await simulateTxs(connection, [
            ...transactions,
        ]);
        if (!simultationResult) {
            console.log("simulation error. plz try again");
            return false;
        }
        console.log("simulation success");
        return true;
    }

    const JITO_CLIENTS = [
      "frankfurt.mainnet.block-engine.jito.wtf",
      "ny.mainnet.block-engine.jito.wtf",
      "amsterdam.mainnet.block-engine.jito.wtf",
      "tokyo.mainnet.block-engine.jito.wtf",
      "slc.mainnet.block-engine.jito.wtf",
    ];
    
    const index = getRandomNumber(0, 4);
    const jitoClient = JITO_CLIENTS[index];
    console.log("JitoClient", jitoClient);
    
    try {
      const clientSearch = searcherClient(jitoClient);
      const bundle = new Bundle(transactions, transactions.length);

      const bundleId = await clientSearch.sendBundle(bundle);
      console.log("bundleId", bundleId);
      
      return (await confirmJitoTransaction(connection, jitoTxsignature, latestBlockhash, 10000));

    } catch (error) {
      console.log("jito error", error);
      return false;
    }
  } catch (error) {
    return false;
  }
};

exports.jitoWithAxios = async (transactions, latestBlockhash, connection) => {
  try {
    console.log(
      `Starting Jito transaction execution... transaction count: ${transactions.length}`
    );

    const jitoTxsignature = bs58.encode(transactions[0].signatures[0]);
    const serializedTransactions = [];
    for (let i = 0; i < transactions.length; i++) {
      const serializedTransaction = bs58.encode(transactions[i].serialize());
      serializedTransactions.push(serializedTransaction);
    }

    // simulation before sending bundle
    const signatures = [];
    const txSizes = [];

    for (let i = 0; i < transactions.length; i++) {
      signatures.push(bs58.encode(transactions[i].signatures[0]));
      txSizes.push(transactions[i].serialize().length);
    }

    txSizes.map((txSize, i) => {
      console.log(`tx size: ${i + 1} => ${txSize}`);
    });
    console.log("signatures");
    console.log(signatures);

    // Simulate bundle
    if (getSimulateMode()) {
        const simultationResult = await simulateTxs(connection, [
            ...transactions,
        ]);
        if (!simultationResult) {
            console.log("simulation error. plz try again");
            return false;
        }
        console.log("simulation success");
        return true;
    }

    const endpoints = [
      "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
      "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
      "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
      "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
      "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles",
    ];

    const index = getRandomNumber(0, 4);
    const url = endpoints[index];
    console.log(url);
    
    try {
        const request = await axios.post(
            `${url}?uuid=${process.env.JITO_UUID}`,
            {
              jsonrpc: "2.0",
              id: 1,
              method: "sendBundle",
              params: [serializedTransactions],
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
        );
    
        if (request && request.data) {
            console.log(`Successful response`);
            console.log(`Confirming jito transaction...`);
            return (await confirmJitoTransaction(connection, jitoTxsignature, latestBlockhash, 20000));

        }  else {
            console.log(`No successful responses received for jito`);
        }
    } catch (error) {
        console.log("jito error", error);
        return false;
    }
    

  } catch (error) {
    return false;
  }
};

exports.sendJitoBundle = async (transactions) => {
  try {
    if (transactions.length === 0) {
      console.log("Error! Empty transactions.");
      return false;
    }

    console.log("Sending bundles...", transactions.length);
    let bundleId = null;
      
    const rawTransactions = transactions.map((item) => {
      return bs58.encode(item.serialize());
    });

    const { data } = await axios.post(
      `https://${process.env.JITO_MAINNET_URL}/api/v1/bundles?uuid=${process.env.JITO_UUID}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [rawTransactions],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-jito-auth": process.env.JITO_UUID,
        },
      }
    );
    if (data) {
      console.log(data);
      bundleId = data.result;
    }

    console.log("Checking bundle's status...", bundleId);
    const sentTime = Date.now();
    while (Date.now() - sentTime < JITO_TIMEOUT) {
      try {
        const { data } = await axios.post(
          `https://${process.env.JITO_MAINNET_URL}/api/v1/bundles?uuid=${process.env.JITO_UUID}`,
          {
            jsonrpc: "2.0",
            id: 1,
            method: "getBundleStatuses",
            params: [[bundleId]],
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (data) {
          const bundleStatuses = data.result.value;
          console.log("Bundle Statuses:", bundleStatuses);
          let success = true;
          
          const matched = bundleStatuses.find(
            (item) => item && item.bundle_id === bundleId
          );
          if (!matched || matched.confirmation_status !== "confirmed") {
            // finalized
            success = false;
            break;
          }

          if (success) return true;
        }
      } catch (err) {
        console.log("JITO ERROR:", err);
      }

      await sleep(1000);
    }
  } catch (err) {
    console.log(err);
    console.log("JITO request failed");
  }
  return false;
};

exports.sendBundleTrxWithTip = async (transactions, tipPayer, tip = 0.002) => {
  const tipTrx = await this.getTipTrx(tipPayer, tip);
  return await this.sendJitoBundle([[...transactions, tipTrx]]);
};

exports.sendBundlesWithSDK = async (client, transactions) => {
  try {
    console.log("Sending bundles...", transactions.length);
    let promiseBundleIds = [];
    for (let i = 0; i < transactions.length; i++) {
      const bundle = new Bundle(transactions[i], transactions[i].length);
      promiseBundleIds.push(client.sendBundle(bundle));
    }

    let code = {};
    let bundleIds = await Promise.all(promiseBundleIds);
    client.onBundleResult(
      (result) => {
        console.log("received bundle result:", result);
        let foundIndex = -1;
        for (let i = 0; i < bundleIds.length; i++) {
          if (result.bundleId === bundleIds[i]) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex < 0 || code[foundIndex] === 1) return;

        // if (log)
        //     addLog("DEBUG", log.title, log.description + ": " + JSON.stringify(result));
        // else
        //     addLog("DEBUG", "Jito Execution", JSON.stringify(result));
        if (result.finalized || result.accepted)
          code[foundIndex] = 1; // SUCCESS
        else if (
          result.rejected &&
          !result.rejected.simulationFailure &&
          !result.rejected.internalError &&
          result.rejected.droppedBundle
        )
          code[foundIndex] = 1; // SUCCESS
        else if (
          result.rejected &&
          result.rejected.simulationFailure &&
          result.rejected.simulationFailure.msg.includes(
            "error=This transaction has already been processed"
          )
        )
          code[foundIndex] = 1; // SUCCESS
      },
      (err) => {
        console.log(err);
      }
    );

    const sentTime = Date.now();
    let success = false;
    while (!success) {
      success = true;
      for (let i = 0; i < bundleIds.length; i++) {
        if (!code[i]) {
          success = false;
          break;
        }
      }

      if (Date.now() - sentTime >= JITO_TIMEOUT) break;
      await sleep(1000);
    }

    return success;
  } catch (err) {
    console.log(err);
  }

  return false;
};

exports.initJitoTipAddr = async () => {
  tipAddrs = await this.getTipAccounts();
  console.log(tipAddrs);
};

exports.useJitoTipAddr = () => {
  return {
    tipAddrs,
  };
};

exports.getJitoTipAccount = () => {
  const { tipAddrs } = this.useJitoTipAddr();

  const tipAccount = tipAddrs[getRandomNumber(0, tipAddrs.length - 1)];
  return tipAccount;
};

exports.sendBundleConfirmTxId = async (
  transactions,
  txHashs,
  connection,
  commitment = "confirmed"
) => {
  try {
    if (transactions.length === 0) return false;

    console.log(
      "Sending bundles...",
      transactions.length,
    );
    let bundleId = null;
    
    const rawTransactions = transactions.map((item) => {
      return bs58.encode(item.serialize());
    });

    const { data } = await axios.post(
      `https://${process.env.JITO_MAINNET_URL}/api/v1/bundles?uuid=${process.env.JITO_UUID}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [
          rawTransactions
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-jito-auth": process.env.JITO_UUID,
        },
      }
    );
    if (data) {
      console.log(data);
      bundleId = data.result;
    }

    console.log("Checking bundle's status...", bundleId);
    const sentTime = Date.now();
    while (
      Date.now() - sentTime <
      (commitment == "finalized" ? JITO_TIMEOUT * 4 : JITO_TIMEOUT)
    ) {
      try {
        let success = true;
        
        let ret = await connection.getTransaction(txHashs[0], {
          commitment: commitment,
          maxSupportedTransactionVersion: 1,
        });

        if (ret && ret.meta && ret.meta.err == null) {
          console.log("checked", bundleId);
        } else {
          success = false;
          break;
        }

        if (success) {
          console.log("Success sendBundleConfirmTxId");
          return true;
        }
      } catch (err) {
        console.log(err);
      }

      await sleep(1000);
    }
  } catch (err) {
    if(err.response.data) {
      console.log(err.response.data);
    } else {
      console.log(err);
    }
  }
  return false;
};
