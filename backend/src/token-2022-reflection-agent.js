require("dotenv").config({ path: process.env.env_file });
const { setGlobalDispatcher, Agent } = require("undici");
const { connectDatabase } = require("./config/database");
const { initConnections, useConnection } = require("./utils/connection");
const { initJitoTipAddr, sendBundleTrxWithTip, useJitoTipAddr, sendBundles } = require("./utils/jito");
const projectModel = require("./models/projectModel");
const walletModel = require("./models/walletModel");
const { Keypair, LAMPORTS_PER_SOL, Connection } = require("@solana/web3.js");
const bs58 = require("bs58");
const { createAssociatedTokenAccountIdempotent, TOKEN_2022_PROGRAM_ID, unpackAccount, getTransferFeeAmount, createWithdrawWithheldTokensFromAccountsInstruction, withdrawWithheldTokensFromAccounts, getAssociatedTokenAddressSync, createAssociatedTokenAccount, getAccount, harvestWithheldTokensToMint, withdrawWithheldTokensFromMint, createWithdrawWithheldTokensFromMintInstruction, createHarvestWithheldTokensToMintInstruction, createAssociatedTokenAccountInstruction, createBurnInstruction, NATIVE_MINT, createTransferInstruction, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");
const { sleep, sendAndConfirmVersionedTransactions, isValidAddress, getRandomNumber } = require("./utils/common");
const { initSdk } = require("./utils/raydiumSdk");
const BN = require("bn.js");
const { SystemProgram } = require("@solana/web3.js");
const { VersionedTransaction } = require("@solana/web3.js");
const { TransactionMessage } = require("@solana/web3.js");
const { Transaction } = require("@solana/web3.js");
const { RAYDIUM_VAULT_AUTHORITY_2 } = require("./constants");
const axios = require("axios");
const { buildTxOnNB } = require("./utils/nextblock");

// let appConsole = {};
// appConsole.log = console.log;
// console.log = function() {
//     appConsole.log(">", ...arguments);
// }

connectDatabase()
let threads = {}

async function getTransferFeeAccountsOfToken2022(connection, mint) {
    try {
        const allAccounts = await connection.getProgramAccounts(
            TOKEN_2022_PROGRAM_ID,
            {
                commitment: 'confirmed',
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: mint,
                        },
                    },
                    {
                        memcmp: {
                            offset: 165,
                            bytes: "3", // the number 2 as base58, which means AccountType::Account
                        }
                    },
                ],
            }
        )

        const accounts = []
        for (const accountInfo of allAccounts) {
            const account = unpackAccount(accountInfo.pubkey, accountInfo.account, TOKEN_2022_PROGRAM_ID);
            accounts.push(account)
        }
        // console.log('accountsToWithdrawFrom: ', accountsToWithdrawFrom);
        return accounts;
    } catch (error) {
        console.log('Error to get fee accounts');
        return null;
    }
}

async function withdrawHeldToken2022(connection, mintAddress, withdrawFeeAuthorityKeypair) {
    console.log("+++++++++++++++++++withdrawHeldToken2022+++++++++++++++++")
    try {
        const mint = new PublicKey(mintAddress);
        const ata = getAssociatedTokenAddressSync(mint, withdrawFeeAuthorityKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID)
        let accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        while (!accounts) {
            await sleep(2000);
            accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        }
        await sleep(300);
        const accountsToWithdrawFrom = [];

        for (const account of accounts) {
            const transferFeeAmount = getTransferFeeAmount(account);
            if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > BigInt(0)) {
                accountsToWithdrawFrom.push(account.address);
            }
        }

        let sources = []
        let flag = false
        for (let i = 0; i < accountsToWithdrawFrom.length; i++) {
            flag = true;
            const pubkey = accountsToWithdrawFrom[i]
            console.log(pubkey.toBase58())
            sources.push(pubkey);
            if (sources.length == 10) {
                console.log("withdrawWithheldTokensFromAccounts")
                try {
                    console.log("start --------- withdrawWithheldTokensFromAccounts")
                    const transaction = new Transaction().add(
                        createWithdrawWithheldTokensFromAccountsInstruction(
                            mint,
                            ata,
                            withdrawFeeAuthorityKeypair.publicKey,
                            [],
                            sources,
                            TOKEN_2022_PROGRAM_ID
                        )
                    )
                    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                    transaction.sign(withdrawFeeAuthorityKeypair);

                    await connection.sendRawTransaction(transaction.serialize(), {
                        skipPreflight: true,
                        commitment: "processed",
                        maxRetries: 1,
                    });

                    // withdrawWithheldTokensFromAccounts(
                    //     connection,
                    //     withdrawFeeAuthorityKeypair,
                    //     mint,
                    //     ata,
                    //     withdrawFeeAuthorityKeypair,
                    //     [],
                    //     sources,
                    //     { commitment: 'processed', maxRetries: 1 },
                    //     TOKEN_2022_PROGRAM_ID
                    // )
                    console.log("end --------- withdrawWithheldTokensFromAccounts")
                } catch (err) {
                    console.log(err)
                }

                await sleep(200);
                console.log("harvestWithheldTokensToMint")
                try {
                    console.log("start ------------  harvestWithheldTokensToMint")
                    const transaction = new Transaction().add(
                        createHarvestWithheldTokensToMintInstruction(
                            mint,
                            sources,
                            TOKEN_2022_PROGRAM_ID
                        )
                    )
                    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                    transaction.sign(withdrawFeeAuthorityKeypair);

                    await connection.sendRawTransaction(transaction.serialize(), {
                        skipPreflight: true,
                        commitment: "processed",
                        maxRetries: 1,
                    });

                    // harvestWithheldTokensToMint(
                    //     connection,
                    //     withdrawFeeAuthorityKeypair,
                    //     mint,
                    //     sources,
                    //     { commitment: 'processed', maxRetries: 1 },
                    //     TOKEN_2022_PROGRAM_ID
                    // )
                    console.log("end ------------  harvestWithheldTokensToMint")
                } catch (err) {
                    console.log(err)
                }
                sources = [];
                await sleep(200)
            }
        }

        if (sources.length > 0) {
            console.log("withdrawWithheldTokensFromAccounts")
            try {
                const transaction = new Transaction().add(
                    createWithdrawWithheldTokensFromAccountsInstruction(
                        mint,
                        ata,
                        withdrawFeeAuthorityKeypair.publicKey,
                        [],
                        sources,
                        TOKEN_2022_PROGRAM_ID
                    )
                )
                transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                transaction.sign(withdrawFeeAuthorityKeypair);

                await connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1,
                });

                // withdrawWithheldTokensFromAccounts(
                //     connection,
                //     withdrawFeeAuthorityKeypair,
                //     mint,
                //     ata,
                //     withdrawFeeAuthorityKeypair,
                //     [],
                //     sources,
                //     { commitment: 'finalized', maxRetries: 1 },
                //     TOKEN_2022_PROGRAM_ID
                // )
            } catch (err) {
                console.log(err);
            }
            await sleep(200);
            console.log("harvestWithheldTokensToMint")
            try {
                const transaction = new Transaction().add(
                    createHarvestWithheldTokensToMintInstruction(
                        mint,
                        sources,
                        TOKEN_2022_PROGRAM_ID
                    )
                )
                transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                transaction.sign(withdrawFeeAuthorityKeypair);

                await connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1,
                });
                // harvestWithheldTokensToMint(
                //     connection,
                //     withdrawFeeAuthorityKeypair,
                //     mint,
                //     sources,
                //     { commitment: 'finalized', maxRetries: 1 },
                //     TOKEN_2022_PROGRAM_ID
                // )
            } catch (err) {
                console.log(err)
            }
            sources = [];
        }
        await sleep(200);
        if (flag) {
            try {
                const transaction = new Transaction().add(
                    createWithdrawWithheldTokensFromMintInstruction(
                        mint,
                        ata,
                        withdrawFeeAuthorityKeypair.publicKey,
                        [],
                        TOKEN_2022_PROGRAM_ID
                    )
                )
                transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                transaction.sign(withdrawFeeAuthorityKeypair);

                await connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1,
                });
                // withdrawWithheldTokensFromMint(
                //     connection,
                //     withdrawFeeAuthorityKeypair,
                //     mint,
                //     ata,
                //     withdrawFeeAuthorityKeypair,
                //     [],
                //     { commitment: 'finalized', maxRetries: 1 },
                //     TOKEN_2022_PROGRAM_ID
                // )
            } catch (err) {
                console.log(err)
            }
        }
        await sleep(200)
    } catch (error) {
        console.log("Error[launch::withdrawHeldToken2022]: ", error);
    }
    console.log("---------------withdrawHeldToken2022-----------------")
    console.log("")
}

async function swapBack(connection, mintAddress, rewardCA, withdrawFeeAuthorityKeypair, poolId) {
    try {
        const mint = new PublicKey(mintAddress);
        const ata = getAssociatedTokenAddressSync(mint, withdrawFeeAuthorityKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID)
        const ataInfo = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
        const raydium = await initSdk(connection, withdrawFeeAuthorityKeypair.publicKey, true);
        const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
        const rpcData = poolData.rpcData

        let inputAmount = new BN(ataInfo.amount.toString());
        if (inputAmount.gt(rpcData.quoteReserve.divn(100))) {
            inputAmount = rpcData.quoteReserve.divn(100)
        }


        const solQuoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
            params: {
                inputMint: mintAddress,
                outputMint: NATIVE_MINT.toBase58(),
                amount: inputAmount.toString(),
                slippageBps: 50
            }
        });
        console.log({ quoteResponse: solQuoteResponse.data });

        if (new BN(solQuoteResponse.data.outAmount).lt(new BN(parseFloat(process.env.SOL_LIMIT) * LAMPORTS_PER_SOL))) {
            return { state: false, amount: new BN(0) }
        }

        const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
            params: {
                inputMint: mintAddress,
                outputMint: rewardCA ? rewardCA : NATIVE_MINT.toBase58(),
                amount: inputAmount.toString(),
                slippageBps: 50
            }
        });
        console.log({ quoteResponse: quoteResponse.data });

        const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
            quoteResponse: quoteResponse.data,
            userPublicKey: withdrawFeeAuthorityKeypair.publicKey.toString(),
            wrapAndUnwrapSol: true,
            prioritizationFeeLamports: 10000
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { swapTransaction } = swapResponse.data;

        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        // Replace the blockhash
        transaction.message.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;

        // Sign the transaction
        transaction.sign([withdrawFeeAuthorityKeypair]);

        const ret = await buildTxOnNB(transaction, withdrawFeeAuthorityKeypair, 0.001);

        return { state: ret, amount: new BN(quoteResponse.data.outAmount).muln(0.9) }
    } catch (err) {
        console.log(err)
        return { state: false, amount: new BN(0) }
    }
}

async function distributeSol(connection, mintAddress, rewardCA, withdrawFeeAuthorityKeypair, totalAmount, treasuries) {
    try {
        let rewardTokenProgramId = TOKEN_PROGRAM_ID;
        let sourceATA;
        if (rewardCA && rewardCA != NATIVE_MINT.toBase58()) {
            const rewardTokenInfo = await connection.getAccountInfo(new PublicKey(rewardCA));
            rewardTokenProgramId = rewardTokenInfo.owner;
            sourceATA = getAssociatedTokenAddressSync(new PublicKey(rewardCA), withdrawFeeAuthorityKeypair.publicKey, false, rewardTokenProgramId);
        }
        let accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        while (!accounts) {
            await sleep(2000);
            accounts = await getTransferFeeAccountsOfToken2022(connection, mintAddress);
        }
        let sum = new BN(0);
        for (const account of accounts) {
            if (account.owner.toBase58() == RAYDIUM_VAULT_AUTHORITY_2 || account.owner.toBase58() == withdrawFeeAuthorityKeypair.publicKey.toBase58()) continue;

            sum = sum.add(new BN(account.amount.toString()));
        }

        let remainingAmount = totalAmount;

        let instructions = []
        let txItems = []

        if (treasuries && treasuries.length > 0) {
            let totalPercent = 0;
            for (let i = 0; i < treasuries.length; i++) {
                if (treasuries[i].percent > 100 || treasuries[i].percent < 0) continue;
                totalPercent = totalPercent + treasuries[i].percent;
            }
            if (totalPercent > 100) {
                for (let i = 0; i < treasuries.length; i++) {
                    if (treasuries[i].percent > 100 || treasuries[i].percent < 0) continue;
                    if (isValidAddress(treasuries[i].address)) {
                        const amount = remainingAmount.muln(treasuries[i].percent).divn(100);
                        remainingAmount = remainingAmount.sub(amount);
                        if (amount.gt(new BN(0))) {
                            if (rewardCA && rewardCA != NATIVE_MINT.toBase58()) {
                                const targetATA = getAssociatedTokenAddressSync(new PublicKey(rewardCA), new PublicKey(treasuries[i].address), false, rewardTokenProgramId)
                                try {
                                    const info = await connection.getAccountInfo(targetATA);
                                    if (!info) {
                                        instructions.push(
                                            createAssociatedTokenAccountInstruction(
                                                withdrawFeeAuthorityKeypair.publicKey,
                                                targetATA,
                                                new PublicKey(treasuries[i].address),
                                                new PublicKey(rewardCA),
                                                rewardTokenProgramId
                                            )
                                        )
                                    }
                                }
                                catch (err) {
                                    console.log(err);
                                }

                                instructions.push(
                                    createTransferInstruction(
                                        sourceATA,
                                        targetATA,
                                        withdrawFeeAuthorityKeypair.publicKey,
                                        amount.toString(),
                                        [],
                                        rewardTokenProgramId
                                    )
                                )
                            } else {
                                instructions.push(
                                    SystemProgram.transfer({
                                        fromPubkey: withdrawFeeAuthorityKeypair.publicKey,
                                        toPubkey: new PublicKey(treasuries[i].address),
                                        lamports: amount.toString()
                                    })
                                )
                            }
                        }
                    }
                }
            } else {
                for (let i = 0; i < treasuries.length; i++) {
                    if (treasuries[i].percent > 100 || treasuries[i].percent < 0) continue;
                    if (isValidAddress(treasuries[i].address)) {
                        const amount = remainingAmount.muln(treasuries[i].percent).divn(100);
                        if (amount.gt(new BN(0))) {
                            if (rewardCA && rewardCA != NATIVE_MINT.toBase58()) {
                                const targetATA = getAssociatedTokenAddressSync(new PublicKey(rewardCA), new PublicKey(treasuries[i].address), false, rewardTokenProgramId)
                                try {
                                    const info = await connection.getAccountInfo(targetATA);
                                    if (!info) {
                                        instructions.push(
                                            createAssociatedTokenAccountInstruction(
                                                withdrawFeeAuthorityKeypair.publicKey,
                                                targetATA,
                                                new PublicKey(treasuries[i].address),
                                                new PublicKey(rewardCA),
                                                rewardTokenProgramId
                                            )
                                        )
                                    }
                                }
                                catch (err) {
                                    console.log(err);
                                }

                                instructions.push(
                                    createTransferInstruction(
                                        sourceATA,
                                        targetATA,
                                        withdrawFeeAuthorityKeypair.publicKey,
                                        amount.toString(),
                                        [],
                                        rewardTokenProgramId
                                    )
                                )
                            } else {
                                instructions.push(
                                    SystemProgram.transfer({
                                        fromPubkey: withdrawFeeAuthorityKeypair.publicKey,
                                        toPubkey: new PublicKey(treasuries[i].address),
                                        lamports: amount.toString()
                                    })
                                )
                            }
                        }
                    }
                }
                remainingAmount = remainingAmount.muln(100 - totalPercent).divn(100);
            }
        }

        if (process.env.FEE_WALLET && process.env.FEE_PERCENT && isValidAddress(process.env.FEE_WALLET)) {
            const amount = remainingAmount.muln(Number(process.env.FEE_PERCENT)).divn(100);
            remainingAmount = remainingAmount.sub(amount);
            if (amount.gt(new BN(0))) {
                if (rewardCA && rewardCA != NATIVE_MINT.toBase58()) {
                    const targetATA = getAssociatedTokenAddressSync(new PublicKey(rewardCA), new PublicKey(process.env.FEE_WALLET), false, rewardTokenProgramId)
                    try {
                        const info = await connection.getAccountInfo(targetATA);
                        if (!info) {
                            instructions.push(
                                createAssociatedTokenAccountInstruction(
                                    withdrawFeeAuthorityKeypair.publicKey,
                                    targetATA,
                                    new PublicKey(process.env.FEE_WALLET),
                                    new PublicKey(rewardCA),
                                    rewardTokenProgramId
                                )
                            )
                        }
                    }
                    catch (err) {
                        console.log(err);
                    }

                    instructions.push(
                        createTransferInstruction(
                            sourceATA,
                            targetATA,
                            withdrawFeeAuthorityKeypair.publicKey,
                            amount.toString(),
                            [],
                            rewardTokenProgramId
                        )
                    )
                } else {
                    instructions.push(
                        SystemProgram.transfer({
                            fromPubkey: withdrawFeeAuthorityKeypair.publicKey,
                            toPubkey: new PublicKey(process.env.FEE_WALLET),
                            lamports: amount.toString()
                        })
                    )
                }
            }
        }

        if (instructions.length >= 6) {
            try {
                const tx = new VersionedTransaction(new TransactionMessage({
                    instructions,
                    payerKey: withdrawFeeAuthorityKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                }).compileToV0Message());

                tx.sign([withdrawFeeAuthorityKeypair]);
                const rawTransaction = tx.serialize();
                await connection.sendRawTransaction(rawTransaction, {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1,
                });

                instructions = []
            } catch (err) {
                console.log(err);
            }
            await sleep(800);
        }

        for (const account of accounts) {
            if (account.owner.toBase58() == RAYDIUM_VAULT_AUTHORITY_2 || account.owner.toBase58() == withdrawFeeAuthorityKeypair.publicKey.toBase58()) continue;

            const amount = remainingAmount.mul(new BN(account.amount.toString())).div(sum);
            if (amount.gt(new BN(0))) {
                if (rewardCA && rewardCA != NATIVE_MINT.toBase58()) {
                    const targetATA = getAssociatedTokenAddressSync(new PublicKey(rewardCA), account.owner, false, rewardTokenProgramId)
                    try {
                        const info = await connection.getAccountInfo(targetATA);
                        if (!info) {
                            instructions.push(
                                createAssociatedTokenAccountInstruction(
                                    withdrawFeeAuthorityKeypair.publicKey,
                                    targetATA,
                                    account.owner,
                                    new PublicKey(rewardCA),
                                    rewardTokenProgramId
                                )
                            )
                        }
                    }
                    catch (err) {
                        console.log(err);
                    }

                    instructions.push(
                        createTransferInstruction(
                            sourceATA,
                            targetATA,
                            withdrawFeeAuthorityKeypair.publicKey,
                            amount.toString(),
                            [],
                            rewardTokenProgramId
                        )
                    )
                } else {
                    instructions.push(
                        SystemProgram.transfer({
                            fromPubkey: withdrawFeeAuthorityKeypair.publicKey,
                            toPubkey: account.owner,
                            lamports: amount.toString()
                        })
                    )
                }
            }
            if (instructions.length >= 6) {
                try {
                    const tx = new VersionedTransaction(new TransactionMessage({
                        instructions,
                        payerKey: withdrawFeeAuthorityKeypair.publicKey,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                    }).compileToV0Message());

                    tx.sign([withdrawFeeAuthorityKeypair]);
                    const rawTransaction = tx.serialize();
                    await connection.sendRawTransaction(rawTransaction, {
                        skipPreflight: true,
                        commitment: "processed",
                        maxRetries: 1,
                    });

                    instructions = []
                } catch (err) {
                    console.log(err);
                }
                await sleep(800);
            }
        }
        if (instructions.length > 0) {
            try {
                const tx = new VersionedTransaction(new TransactionMessage({
                    instructions,
                    payerKey: withdrawFeeAuthorityKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash
                }).compileToV0Message());

                tx.sign([withdrawFeeAuthorityKeypair]);
                const rawTransaction = tx.serialize();
                await connection.sendRawTransaction(rawTransaction, {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1,
                });

                instructions = []
            } catch (err) {
                console.log(err)
            }
            await sleep(800);
        }
    } catch (err) {
        console.log(err)
    }
}

async function getWithrawTaxAndDistribute(tokenInfo, poolId) {
    try {
        let usualConnection = null;
        const { connection } = useConnection();

        if (tokenInfo.customRpc) {
            try {
                usualConnection = new Connection(tokenInfo.customRpc, "finalized");
                const balance = await usualConnection.getBalance(new PublicKey("7XmZ5QxqVJ49SZLmiGsSGmb3sQhaixR9e5tm1gK3iW2y"));
            } catch (err) {
                usualConnection = connection;
            }
        } else {
            usualConnection = connection;
        }

        const mintAddress = tokenInfo.address;
        const authority = tokenInfo.authority;

        const mint = new PublicKey(mintAddress);
        const walletItem = await walletModel.findOne({ address: authority });
        const withdrawFeeAuthorityKeypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
        const ata = getAssociatedTokenAddressSync(mint, withdrawFeeAuthorityKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID)
        if (!(await connection.getAccountInfo(ata))) {
            try {
                const transaction = new Transaction().add(
                    createAssociatedTokenAccountInstruction(
                        withdrawFeeAuthorityKeypair.publicKey,
                        ata,
                        withdrawFeeAuthorityKeypair.publicKey,
                        mint,
                        TOKEN_2022_PROGRAM_ID
                    )
                );

                transaction.recentBlockhash = (await usualConnection.getLatestBlockhash()).blockhash;
                transaction.feePayer = withdrawFeeAuthorityKeypair.publicKey;
                transaction.sign(withdrawFeeAuthorityKeypair)

                await connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: true,
                    commitment: "processed",
                    maxRetries: 1
                })
                await sleep(2000);
            } catch (err) {
                console.log(err)
                return;
            }
        }

        // const tx = new Transaction().add(createBurnInstruction(ata, mint, withdrawFeeAuthorityKeypair.publicKey, "100000000000000", [], TOKEN_2022_PROGRAM_ID));
        // tx.recentBlockhash = (await usualConnection.getLatestBlockhash()).blockhash;
        // tx.feePayer = withdrawFeeAuthorityKeypair.publicKey;
        // tx.sign(withdrawFeeAuthorityKeypair);
        // await usualConnection.sendRawTransaction(tx.serialize(), {
        //     skipPreflight: true,
        //     commitment: "processed",
        //     maxRetries: 1
        // })


        await withdrawHeldToken2022(usualConnection, mintAddress, withdrawFeeAuthorityKeypair);

        const { state, amount } = await swapBack(usualConnection, mintAddress, tokenInfo.rewardCA, withdrawFeeAuthorityKeypair, poolId);
        const balance = await usualConnection.getBalance(new PublicKey(withdrawFeeAuthorityKeypair.publicKey))
        if (state) {
            await distributeSol(usualConnection, mintAddress, tokenInfo.rewardCA, withdrawFeeAuthorityKeypair, amount, tokenInfo.treasuries);
        }

    } catch (err) {
        console.log(err)
    }
}

async function reflectTaxToken(project) {
    console.log("|||||   start ---- ", project.token.address, project.token.interval * 1000)
    getWithrawTaxAndDistribute(project.token, project.poolInfo.poolId);
    threads[project._id.toString()] = setInterval(() => {
        getWithrawTaxAndDistribute(project.token, project.poolInfo.poolId);
    }, project.token.interval * 1000)
}

async function main() {
    setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));
    await initConnections();

    while (true) {
        const projects = await projectModel.find({ platform: "token-2022" });
        if (!projects) return;
        for (let i = 0; i < projects.length; i++) {
            if (projects[i].status == "EXPIRED") {
                if (threads[projects[i]._id.toString()]) {
                    clearInterval(threads[projects[i]._id.toString()])
                }
            } else if (projects[i].status == "TRADE") {
                if (threads[projects[i]._id.toString()])
                    continue;

                reflectTaxToken(projects[i]);
            }
        }
        await sleep(5 * 60 * 1000)
    }
}

main()

