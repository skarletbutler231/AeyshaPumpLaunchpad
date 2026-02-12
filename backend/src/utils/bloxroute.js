const {
    addMemoToSerializedTxn,
    createTraderAPIMemoInstruction,
    HttpProvider,
    MAINNET_API_GRPC_PORT,
    MAINNET_API_NY_GRPC,
    PostSubmitRequestEntry
} = require("@bloxroute/solana-trader-client-ts")
const {
    ComputeBudgetProgram,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} = require("@solana/web3.js")
const {
    LOOKUP_TABLE_CACHE,
} = require("@raydium-io/raydium-sdk")
const base58 = require("bs58");
const { AxiosRequestConfig } = require("axios");
const axios = require('axios');
const { sleep } = require("./common");
const { useConnection } = require("./connection");

exports.TRADER_API_TIP_WALLET = "HWEoBxYs7ssKuudEjzjmpfJVX7Dvi7wescFsVx2L5yoY"
const AUTH_HEADER = process.env.BLOXROUTE_AUTH_HEADER

const requestConfig = {
    timeout: 30_000,
}

const provider = new HttpProvider(
    AUTH_HEADER,
    base58.encode(Keypair.generate().secretKey)
)

// createTraderAPIMemoInstruction generates a transaction instruction that places a memo in the transaction log
// Having a memo instruction with signals Trader-API usage is required
exports.CreateTraderAPITipInstruction = (
    senderAddress,
    tipAmount
) => {
    const tipAddress = new PublicKey(this.TRADER_API_TIP_WALLET)

    return SystemProgram.transfer({
        fromPubkey: senderAddress,
        toPubkey: tipAddress,
        lamports: tipAmount,
    })
}

exports.buildBlxrTipInstructions = (
    payer,
    tip
) => {
    const blrxTipInstr = this.CreateTraderAPITipInstruction(payer, tip * LAMPORTS_PER_SOL)
    const memo = createTraderAPIMemoInstruction("")

    const blxrTipInstructions = [blrxTipInstr, memo]
    return blxrTipInstructions
}

exports.buildBlxrTipTransaction = async (
    signer,
    tip
) => {
    const blrxTipInstr = this.CreateTraderAPITipInstruction(signer.publicKey, tip * LAMPORTS_PER_SOL)
    const memo = createTraderAPIMemoInstruction("")
    const tipTx = new Transaction().add(blrxTipInstr, memo)

    const { connection } = useConnection();
    tipTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tipTx.sign(signer);

    return tipTx;
}

exports.buildRawBundlesOnBX = async (
    txs
) => {

    console.log("bundle length:", txs.length);

    let bundleTransaction = []
    for (let i = 0; i < txs.length; i++) {
        try {
            const tx = txs[i]
            let typedTx = tx;

            if (tx.type != "Buffer") {
                typedTx = {
                    type: "Buffer",
                    data: Object.values(tx)
                }
            }

            let buff = Buffer.from(typedTx)
            let encodedTxn = buff.toString("base64");

            console.log(`bloXroute trx(${i}) len = `, encodedTxn.length)

            bundleTransaction.push({
                transaction: {
                    content: encodedTxn,
                    isCleanup: false
                },
                skipPreFlight: false
            })
        } catch (err) {
            console.log(err)
        }
    }

    try {
        const response = await provider.postSubmitBatch({
            entries: bundleTransaction,
            submitStrategy: "P_SUBMIT_ALL",
            useBundle: true
        });

        console.log(`Bloxroute BundleTransaction hash : `, response.transactions[0].signature);
        if (response.transactions[0].signature != "") {
            return true;
        }
    } catch (err) {
        console.log(err);
    }

    return false
}

exports.buildBundlesOnBX = async (
    txs,
    signer,
    tip,
    skipPreFlight
) => {

    console.log("bundle length:", txs.length);
    let bundleResults = [];
    const { connection } = useConnection()
    for (let bi = 0; bi < txs.length; bi++) {

        let bundleTransaction = []

        console.log(`bundle trx count = `, txs[bi].length)

        for (let j = 0; j < txs[bi].length; j++) {
            console.log(await connection.simulateTransaction(txs[bi][j]))
        }

        for (let i = 0; i < txs[bi].length; i++) {
            const tx = txs[bi][i]

            let buff = Buffer.from(tx.serialize())
            let encodedTxn = buff.toString("base64");

            console.log(`bloXroute trx(${bi})(${i}) len = `, encodedTxn.length)

            bundleTransaction.push({
                transaction: {
                    content: encodedTxn,
                    isCleanup: false
                },
                skipPreFlight: false
            })
        }

        try {
            const response = await provider.postSubmitBatch({
                entries: bundleTransaction,
                submitStrategy: "P_SUBMIT_ALL",
                useBundle: true
            });

            console.log(`Bloxroute BundleTransaction hash : `, response.transactions[0].signature);
            if (response.transactions[0].signature != "") {
                bundleResults.push(response.transactions[0].signature)
            }

            const ret = await this.getBlxTrxStatus(response.transactions[0].signature);
            if (!ret)
                return false;
        } catch (err) {
            console.log(err);
            return false
        }

        await sleep(500);
    }

    return true;
}

exports.getBlxTrxStatus = async (txid) => {
    let startTime = Date.now(), endTime = 0;
    if (txid !== undefined) {
        let breakCheckTransactionStatus = false
        setTimeout(() => {
            breakCheckTransactionStatus = true;
        }, 12000);

        while (!breakCheckTransactionStatus) {
            await sleep(1000);
            let transactionHash = txid //'3wCx6Js7hWpWBaJvW5rU39nYupLeTpqrxnXw7ESSi3o52TDUBWjH46XJmhQnZeUFKQSQi3pztniexqmgzZ8BU682', '5f7e299hg33CuJyko8W69fKQAew5M3FKoKGtDfv713mUqV1KZ6CKiMjpfVkFEKhs5DV9DnC3Rr1twA6GrZS7cJCk'
            try {
                const res = await axios.get(`https://ny.solana.dex.blxrbdn.com/api/v2/transaction?signature=${transactionHash}`, {
                    headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/json'
                    }
                });
                // console.log(res.data);

                if (res.data.status === 'success') {
                    breakCheckTransactionStatus = true
                    endTime = Date.now();
                    console.log(`✅ BloXroute Transaction hash : https://solscan.io/tx/${txid} checking time : ${endTime - startTime} ms`)
                    return true
                } else if (res.data.status === 'failed') {
                    breakCheckTransactionStatus = true
                    break
                } else { //'not_found'

                }

            } catch (error) {
                console.error('BloXroute API requesting Error :', error.response ? error.response.data : error.message);
            }
        }
    }
    return false
}

exports.buildOneBundleOnBX = async (
    txs,
    signer,
    tip,
    skipPreFlight
) => {

    const blrxTipInstr = this.CreateTraderAPITipInstruction(signer.publicKey, tip * LAMPORTS_PER_SOL)
    const memo = createTraderAPIMemoInstruction("")

    const blxrTipInstructions = [blrxTipInstr, memo]

    let bundleTransaction = []

    console.log(`bundle trx count = `, txs.length)

    for (let i = 0; i < txs.length; i++) {
        const tx = txs[i]
        const swapInstructions = TransactionMessage.decompile(tx.message).instructions

        const latestBlockhash = await provider.getRecentBlockHash({})

        let swapMessage

        if (i == txs.length - 1) {
            swapMessage = new Transaction({
                recentBlockhash: latestBlockhash.blockHash,
                feePayer: signer.publicKey,
            })
                .add(...swapInstructions)
                .add(...blxrTipInstructions)
        } else {
            swapMessage = new Transaction({
                recentBlockhash: latestBlockhash.blockHash,
                feePayer: signer.publicKey,
            })
                .add(...swapInstructions)
                .add(memo)
        }

        swapMessage.sign(signer)
        let buff = Buffer.from(swapMessage.serialize())
        let encodedTxn = buff.toString("base64");

        console.log(`bloXroute trx(${i}) len = `, encodedTxn.length)

        bundleTransaction.push({
            transaction: {
                content: encodedTxn,
                isCleanup: false
            },
            skipPreFlight: false
        })
    }

    const response = await provider.postSubmitBatch({
        entries: bundleTransaction,
        submitStrategy: "P_SUBMIT_ALL",
        useBundle: true
    });

    console.log(`Bloxroute BundleTransaction hash : `, response.transactions[0].signature);

    return response.transactions[0].signature;
}

exports.buildSingleOnBX = async (
    txs,
    signer,
    tip,
    feeIns = [],
    skipPreFlight = true
) => {
    const entries = [];

    let clientMode = String(process.env.BOT_PRODUCTION) == "server" ? false : true;

    let tipAmount = clientMode ? 0.0001 : tip

    const blrxTipInstr = this.CreateTraderAPITipInstruction(signer.publicKey, tipAmount * LAMPORTS_PER_SOL)

    const memo = createTraderAPIMemoInstruction("")
    const tx = txs[0]
    const swapInstructions = TransactionMessage.decompile(tx.message).instructions
    const blxrTipInstructions = [blrxTipInstr, memo]

    // make transactions
    // let units = await getSimulationComputeUnits(
    //   connection,
    //   [...swapInstructions, ...blxrTipInstructions],
    //   signer.publicKey, []
    // )

    const latestBlockhash = await provider.getRecentBlockHash({})

    // let modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    //   units: units ? units + 500 : 80000
    //   // 100000000 
    // });
    // let addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    //   microLamports: 1000000
    // });


    const swapMessage = new Transaction({
        recentBlockhash: latestBlockhash.blockHash,
        feePayer: signer.publicKey,
    })
        .add(...swapInstructions)
        .add(...blxrTipInstructions)
    // const swapMessage = new VersionedTransaction(
    //   new TransactionMessage({
    //     recentBlockhash: latestBlockhash.blockHash,
    //     payerKey: signer.publicKey,
    //     instructions: [modifyComputeUnits, addPriorityFee , ...swapInstructions, ...blxrTipInstructions],
    //   }).compileToV0Message()
    // )

    swapMessage.sign(signer)
    let buff = Buffer.from(swapMessage.serialize())
    let encodedTxn = buff.toString("base64");

    console.log(`bloXroute trx len = `, encodedTxn.length)

    let response
    if (clientMode) {
        response = await provider.postSubmit({
            transaction: {
                content: encodedTxn,
                isCleanup: false
            },
            skipPreFlight: false,
        })
    } else {
        response = await provider.postSubmit({
            transaction: {
                content: encodedTxn,
                isCleanup: false
            },
            skipPreFlight: false,
            frontRunningProtection: false,
            useStakedRPCs: true
        })
    }

    // await provider.postSubmitBatch({
    //   entries,
    //   submitStrategy: "P_SUBMIT_ALL",
    //   useBundle: true
    // });

    console.log(`Bloxroute Transaction hash : ${response.signature}`);
    // let oldhash = '3wCx6Js7hWpWBaJvW5rU39nYupLeTpqrxnXw7ESSi3o52TDUBWjH46XJmhQnZeUFKQSQi3pztniexqmgzZ8BU682'
    // try {
    //   const res = await axios.get(`https://ny.solana.dex.blxrbdn.com/api/v2/transaction?signature=${oldhash}`, {
    //       headers: {
    //           'Authorization': AUTH_HEADER,
    //           'Content-Type': 'application/json'
    //       }
    //   });
    //   console.log(res.data);

    // } catch (error: any) {
    //     console.error('Error bundling:', error.response ? error.response.data : error.message);
    // }

    return response.signature
}
