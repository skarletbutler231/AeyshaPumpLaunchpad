const axios = require('axios');
const {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} = require("@solana/web3.js")

const { useConnection } = require('./connection');

const getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const tipAddresses = [
    "astrazznxsGUhWShqgNtAdfrzP2G83DzcWVJDxwV9bF",
    "astra4uejePWneqNaJKuFFA8oonqCE1sqF6b45kDMZm",
    "astra9xWY93QyfG6yM8zwsKsRodscjQ2uU2HKNL5prk",
    "astraRVUuTHjpwEVvNBeQEgwYx9w9CFyfxjYoobCZhL",
]
const TRADER_API_TIP_WALLET = tipAddresses[getRandomNumber(0, tipAddresses.length - 1)];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TIMEOUT = 10000

// createTraderAPIMemoInstruction generates a transaction instruction that places a memo in the transaction log
// Having a memo instruction with signals Trader-API usage is required
exports.CreateTraderAPITipInstruction = (
    senderAddress,
    tipAmount
) => {
    const tipAddress = new PublicKey(TRADER_API_TIP_WALLET)

    return SystemProgram.transfer({
        fromPubkey: senderAddress,
        toPubkey: tipAddress,
        lamports: Math.floor(tipAmount),
    })
}

exports.buildNBTipTransaction = async (
    signer,
    tip
) => {
    const tipInstr = this.CreateTraderAPITipInstruction(signer.publicKey, tip * LAMPORTS_PER_SOL)
    const tipTx = new Transaction().add(tipInstr)

    const { connection } = useConnection();
    tipTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tipTx.sign(signer);

    return tipTx;
}

const AUTH_HEADER = process.env.ASTRALANE_API_KEY;

const submitTransaction = async (transactionBase64) => {
    try {
        const response = await axios.post(
            'https://fra.nextblock.io/api/v2/submit',
            {
                transaction: {
                    content: transactionBase64,
                },
                frontRunningProtection: true,
            },
            {
                headers: {
                    'authorization': process.env.NEXTBLOCK_AUTH_HEADER,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('✅ Transaction submitted:', response.data);
        return response;
    } catch (error) {
        console.error('❌ Submission failed:', error);
        return null;
    }
}

exports.submitBatchedTransaction = async (txs) => {
    try {
        const final = await fetch(
            `http://ny.gateway.astralane.io/iris?api-key=${AUTH_HEADER}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'sendBundle',
                    params: [txs],
                }),
            },
        );

        const response = await final.json();
        console.log('✅ Transaction submitted:', response);
        return response;
    } catch (error) {
        console.error('❌ Submission failed:', error);
        return null;
    }
}

exports.buildTxOnNB = async (
    tx,
    signer,
    tip,
) => {
    const TipInstr = CreateTraderAPITipInstruction(signer.publicKey, tip * LAMPORTS_PER_SOL)
    const swapInstructions = TransactionMessage.decompile(tx.message).instructions

    const { connection } = useConnection()
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash

    const swapMessage = new Transaction({
        recentBlockhash: recentBlockhash,
        feePayer: signer.publicKey,
    })
        .add(...swapInstructions)
        .add(TipInstr)

    swapMessage.sign(signer)
    let buff = Buffer.from(swapMessage.serialize())
    let encodedTxn = buff.toString("base64");

    const response = await this.submitBatchedTransaction([encodedTxn]);

    return response;
}

exports.buildBundleOnNB = async (
    txs
) => {
    const buffers = txs.map((tx) => Buffer.from(tx.serialize()));
    const encodedTxns = buffers.map((buffer) => buffer.toString("base64"));
    console.log("transaction count", txs.length);
    const response = await this.submitBatchedTransaction(encodedTxns);

    return response;
}


exports.buildBundleOnNBAndConfirmTxId = async (
    connection,
    txs,
    commitment = "finalized"
) => {
    try {
        console.log("Tx Count:", txs.length)
        const buffers = txs.map((tx) => Buffer.from(tx.serialize()));
        const encodedTxns = buffers.map((buffer) => buffer.toString("base64"));

        const response = await this.submitBatchedTransaction(encodedTxns);

        if (response === null) {
            return false;
        }

        const txHash = response.result[0];

        console.log("Checking bundle's status...");
        const sentTime = Date.now();
        while (Date.now() - sentTime < (commitment == "finalized" ? TIMEOUT * 4 : TIMEOUT)) {
            try {
                let success = true;
                let ret = await connection.getTransaction(txHash, {
                    commitment: commitment,
                    maxSupportedTransactionVersion: 1,
                });

                if (ret && ret.meta && ret.meta.err == null) {
                    console.log("checked", txHash);
                } else {
                    success = false;
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

        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

exports.buildBundlesOnNB = async (
    txss
) => {
    try {
        for (let i = 0; i < txss.length; i++) {
            const buffers = txss[i].map((tx) => Buffer.from(tx.serialize()));
            const encodedTxns = buffers.map((buffer) => buffer.toString("base64"));

            const response = await this.submitBatchedTransaction(encodedTxns);
            if (response == null) {
                return false;
            }
            await sleep(500);
        }

        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}