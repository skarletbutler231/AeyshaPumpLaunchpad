const { getJitoTipAccount, sendBundleConfirmTxId, getTipTrx, useJitoTipAddr } = require("./jito");

const BigNumber = require("bignumber.js");
const bs58 = require("bs58");
const BN = require("bn.js");
const axios = require("axios");
const {
    PublicKey, AddressLookupTableProgram, SystemProgram, TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
    NATIVE_MINT,
    TOKEN_2022_PROGRAM_ID,
    getMint,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction,
} = require("@solana/spl-token");
const {
    MAINNET_PROGRAM_ID,
    DEVNET_PROGRAM_ID,
    TOKEN_PROGRAM_ID,    
    SPL_ACCOUNT_LAYOUT,
    Liquidity,
    Percent,
    Token,
    TokenAmount,
    TxVersion,
    poolKeys2JsonInfo,
    jsonInfo2PoolKeys,
    buildSimpleTransaction,
} = require('@raydium-io/raydium-sdk');
const { Market, MARKET_STATE_LAYOUT_V3 } = require('@project-serum/serum');
const projectModel = require("../models/projectModel");
const { Keypair } = require("@solana/web3.js");
const walletModel = require("../models/walletModel");
const Email = require("../models/emailModel");
const { PAYMENT_OPTIONS, BUNDLE_TX_LIMIT } = require("../constants");
const { useConnection } = require("./connection");
const sendEmail = require("./sendEmail");
const { aesEncrypt, aesDecrypt } = require("./aes");
const User = require("../models/userModel");
const { PROGRAM_ID, Metadata } = require("@metaplex-foundation/mpl-token-metadata");
const { REFERRAL_FEE, EXTRA_REFERRAL_FEE, REFERRAL_WHITELIST, programID: PUMPFUN_PROGRAM_ID } = require("../constants/index");
const { buildBundleOnNB, CreateTraderAPITipInstruction, buildBundleOnNBAndConfirmTxId } = require("./astralane");
const { Transaction } = require("@solana/web3.js");
const { ComputeBudgetProgram } = require("@solana/web3.js");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
exports.sleep = sleep;
exports.JITO_TIP = 0.01;
const MAX_WALLET_PER_TX = parseInt(process.env.RAY_INSTRUCTION_LIMIT);

exports.getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};


/**
 * Poll transaction statuses with a timeout and interval.
 * @param {Connection} connection - Solana RPC connection
 * @param {string[]} signatures - Array of transaction signatures
 * @param {number} [timeoutSeconds=60] - Max seconds to poll before timeout
 * @param {number} [pollIntervalMs=2000] - Delay between polls in milliseconds
 * @returns {Promise<Map<string, Object|null>>} - Map of signature to status info or null if timeout
 */
exports.pollTransactionStatuses = async (
    connection,
    signatures,
    timeoutSeconds = 60,
    pollIntervalMs = 2000,
) => {
    const deadline = performance.now() + timeoutSeconds * 1000;
    const pending = new Set(signatures);
    const finalStatuses = new Map();

    while (pending.size > 0 && performance.now() < deadline) {
        const sigsToCheck = Array.from(pending);
        try {
        const result = await connection.getSignatureStatuses(sigsToCheck, { searchTransactionHistory: true });

        for (let i = 0; i < sigsToCheck.length; i++) {
            const sig = sigsToCheck[i];
            const status = result.value ? result.value[i] : null;

            if (status) {
                finalStatuses.set(sig, status);

                // Remove from pending if confirmed (no error) or failed (has error)
                if (status.confirmations === null || status.err) {
                    pending.delete(sig);
                }
            }
        }
        } catch (error) {
            console.log(error);
        }

        if (pending.size === 0) break; // all done

        await this.sleep(pollIntervalMs);
    }

    // For any still pending signatures, set status to null
    for (const sig of pending) {
        finalStatuses.set(sig, null);
    }

    return finalStatuses;
}

exports.isValidAddress = (addr) => {
    try {
        const decodedAddr = bs58.decode(addr);
        if (decodedAddr.length !== 32)
            return false;
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
};

exports.xWeiAmount = (amount, decimals) => {
    return new BN(new BigNumber(amount.toString() + "e" + decimals.toString()).toFixed(0));
};

exports.sendAndConfirmVersionedTransactions = async (connection, transactions) => {
    let retries = 50;
    let passed = {};
    const rawTransactions = transactions.map(item => item.serialize());
    while (retries > 0) {
        try {
            let signatures = {};
            for (let i = 0; i < rawTransactions.length; i++) {
                if (!passed[i]) {
                    signatures[i] = await connection.sendRawTransaction(rawTransactions[i], {
                        skipPreflight: true,
                        maxRetries: 1,
                    });
                }
            }

            const sentTime = Date.now();
            while (Date.now() - sentTime <= 1000) {
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i]) {
                        const ret = await connection.getParsedTransaction(signatures[i], {
                            commitment: "finalized",
                            maxSupportedTransactionVersion: 0,
                        });
                        if (ret)
                            passed[i] = true;
                    }
                }

                let done = true;
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i]) {
                        done = false;
                        break;
                    }
                }

                if (done)
                    return true;

                await sleep(500);
            }
        }
        catch (err) {
            console.log(err);
        }
        retries--;
    }

    return false;
}

exports.sendAndConfirmLegacyTransactions = async (connection, transactions) => {
    let retries = 50;
    let passed = {};
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const rawTransactions = transactions.map(({ transaction, signers }) => {
        transaction.recentBlockhash = recentBlockhash;
        if (signers.length > 0)
            transaction.sign(...signers);
        return transaction.serialize();
    });

    while (retries > 0) {
        try {
            let pendings = {};
            for (let i = 0; i < rawTransactions.length; i++) {
                if (!passed[i]) {
                    pendings[i] = connection.sendRawTransaction(rawTransactions[i], {
                        skipPreflight: true,
                        maxRetries: 0,
                    });
                }
            }

            let signatures = {};
            for (let i = 0; i < rawTransactions.length; i++) {
                if (!passed[i])
                    signatures[i] = await pendings[i];
            }

            const sentTime = Date.now();
            while (Date.now() - sentTime <= 1000) {
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i]) {
                        const ret = await connection.getParsedTransaction(signatures[i], {
                            commitment: "finalized",
                            maxSupportedTransactionVersion: 0,
                        });
                        if (ret) {
                            // console.log("Slot:", ret.slot);
                            // if (ret.transaction) {
                            //     console.log("Signatures:", ret.transaction.signatures);
                            //     console.log("Message:", ret.transaction.message);
                            // }
                            const status = await connection.getSignatureStatus(signatures[i]);
                            if (status) {
                                console.log("Context:", status.context, "Value:", status.context.value);
                            }
                            passed[i] = true;
                        }
                    }
                }

                let done = true;
                for (let i = 0; i < rawTransactions.length; i++) {
                    if (!passed[i]) {
                        done = false;
                        break;
                    }
                }

                if (done)
                    return true;

                await sleep(500);
            }
        }
        catch (err) {
            console.log(err);
        }
        retries--;
    }

    return false;
}

exports.getWalletTokenAccount = async (connection, wallet) => {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
    });
    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
}

exports.checkMigratedToPumpswap = async (tokenAddress) => {
    try {
        const { data } = await axios.get(`https://api.dexscreener.com/token-pairs/v1/solana/${tokenAddress}`, { headers: { "Content-Type": "application/json" } });
        if (data) {
            for (let i = 0; i < data.length; i++) {
                if (data[i].dexId == "pumpswap") {
                    return data[i].pairAddress;
                }
            }
        }
    } catch (err) {

    }
    return null;
}

exports.getPoolInfo = async (connection, token, isToken2022 = false) => {
    console.log("Getting pool info...", token);

    if (!token) {
        console.log("Invalid token address");
        return {};
    }

    let fromPumpfun = await this.isFromPumpfun(connection, token, isToken2022);
    console.log("frompumpfun", fromPumpfun);
    if (fromPumpfun) return null;

    const mint = new PublicKey(token);
    const mintInfo = await getMint(connection, mint);

    const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");

    const PROGRAMIDS = process.env.DEVNET_MODE === "true" ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID;
    let marketAccounts;
    if (fromPumpfun)
        marketAccounts = await Market.findAccountsByMints(connection, quoteToken.mint, baseToken.mint, PROGRAMIDS.OPENBOOK_MARKET);
    else
        marketAccounts = await Market.findAccountsByMints(connection, baseToken.mint, quoteToken.mint, PROGRAMIDS.OPENBOOK_MARKET);

    if (marketAccounts.length === 0) {
        console.log("Not found market info");
        return {};
    }

    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccounts[0].accountInfo.data);
    let poolKeys = Liquidity.getAssociatedPoolKeys({
        version: 4,
        marketVersion: 4,
        baseMint: baseToken.mint,
        quoteMint: quoteToken.mint,
        baseDecimals: baseToken.decimals,
        quoteDecimals: quoteToken.decimals,
        marketId: marketAccounts[0].publicKey,
        programId: PROGRAMIDS.AmmV4,
        marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
    });
    poolKeys.marketBaseVault = marketInfo.baseVault;
    poolKeys.marketQuoteVault = marketInfo.quoteVault;
    poolKeys.marketBids = marketInfo.bids;
    poolKeys.marketAsks = marketInfo.asks;
    poolKeys.marketEventQueue = marketInfo.eventQueue;

    const poolInfo = poolKeys2JsonInfo(poolKeys);
    return poolInfo;
}


exports.getAllPubKeysInPoolKeys = (_poolKeys) => {

    let pubkeys = [_poolKeys.id,
    _poolKeys.baseMint,
    _poolKeys.quoteMint,
    _poolKeys.lpMint,
    _poolKeys.programId,
    _poolKeys.authority,
    _poolKeys.baseVault,
    _poolKeys.quoteVault,
    _poolKeys.lpVault,
    _poolKeys.openOrders,
    _poolKeys.targetOrders,
    _poolKeys.withdrawQueue,
    _poolKeys.marketProgramId,
    _poolKeys.marketId,
    _poolKeys.marketAuthority,
    _poolKeys.lookupTableAccount,
    _poolKeys.configId,
    _poolKeys.marketBaseVault,
    _poolKeys.marketQuoteVault,
    _poolKeys.marketBids,
    _poolKeys.marketAsks,
    _poolKeys.marketEventQueue,
    ]

    return pubkeys
}

exports.createWallets = async (projectId, count) => {
    console.log(`Start creating ${count} wallets...`)
    if (count < 1) throw Error("Wallet amount to create is less than 1.")

    try {
        const project = await projectModel.findById(projectId);

        let wallets = []
        for (let i = 0; i < count; i++) {
            const keypair = Keypair.generate();
            const wallet = await walletModel.create({
                address: keypair.publicKey.toBase58(),
                privateKey: bs58.encode(keypair.secretKey),
                category: "temporary",
                userId: project.userId,
            });
            wallets.push(wallet)
        }
        return wallets
    } catch (err) {
        throw err;
    }
}

exports.getBalance = async (project, username, userrole) => {
    console.log("start getting balance daemon....", username, userrole)

    const currencyAmount = Number(project.paymentId) > 0 ? PAYMENT_OPTIONS[Number(project.paymentId)].cash : PAYMENT_OPTIONS[1].cash

    const { connection } = useConnection()

    const interval = setInterval(async () => {
        let flag = false
        if (userrole == "free") flag = true;
        if (Number(project.paymentId) === 0) {
            flag = true;
        } else {
            const walletPublicKey = new PublicKey(project.depositWallet.address);

            try {
                const balanceInLamports = await connection.getBalance(walletPublicKey)

                console.log(balanceInLamports, currencyAmount);
                if (currencyAmount == 0 || (currencyAmount != 0 && new BN(balanceInLamports.toString()).gte(new BN((currencyAmount * 1_000_000_000).toString())))) {
                    flag = true;
                    const depositWalletItem = await walletModel.findOne(({ address: project.depositWallet.address }));
                    const keypair = Keypair.fromSecretKey(bs58.decode(depositWalletItem.privateKey))
                    const userInfo = await User.findOne({ name: username });
                    const referral = await User.findOne({ _id: userInfo.referral });
                    let latestBlockhash = await connection.getLatestBlockhash();
                    let instructions = [];
                    if (REFERRAL_WHITELIST.includes(referral.name)) {
                        instructions.push(
                            SystemProgram.transfer({
                                fromPubkey: keypair.publicKey,
                                toPubkey: new PublicKey(referral.name),
                                lamports: currencyAmount * EXTRA_REFERRAL_FEE / 100 * LAMPORTS_PER_SOL,
                            })
                        )
                    } else {
                        instructions.push(
                            SystemProgram.transfer({
                                fromPubkey: keypair.publicKey,
                                toPubkey: new PublicKey(referral.name),
                                lamports: currencyAmount * REFERRAL_FEE / 100 * LAMPORTS_PER_SOL,
                            })
                        )
                    }
                    const messageV0 = new TransactionMessage({
                        payerKey: keypair.publicKey,
                        recentBlockhash: latestBlockhash.blockhash,
                        instructions: instructions
                    }).compileToV0Message();

                    const transaction = new VersionedTransaction(messageV0);

                    // Step 3 - Sign your transaction with the required `Signers`
                    transaction.sign([keypair]);

                    await connection.sendTransaction(transaction, { maxRetries: 5 });
                }
            }
            catch (err) {
                console.log(err)
            }
        }

        if (flag) {
            try {
                if (project && project.status === "INIT") {

                    const html = `<p>User Name: "${username}"</p><p>User Role: "${userrole}"</p><p>Project Name: "${project.name}"</p><p>Package: "${project.paymentId}"</p>`;
                    const mails = await Email.find();
                    let pendings = [];
                    for (let i = 0; i < mails.length; i++) {
                        pendings = [
                            ...pendings,
                            sendEmail(
                                {
                                    to: mails[i].email,
                                    subject: process.env.SUBJECT_FOR_CREATE_PROJECT,
                                    html: html,
                                },
                                async (err, data) => {
                                    if (err || data.startsWith("Error")) {
                                        console.log(err);
                                        return;
                                    }

                                    console.log(
                                        "Mail sent successfully with data: " + data
                                    );
                                }
                            ),
                        ];
                    }
                    await Promise.all(pendings);

                    project.status = "OPEN";
                    await project.save();
                }
                clearInterval(interval)
            } catch (e) {
                clearInterval(interval)
            }
        }
    }, [5000])
    await sleep(3600000)
    clearInterval(interval)
}

exports.bufferFromUInt64 = (value) => {
    let buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
}

exports.getPriorifyFeeIxs = (priorityFees) => {
    let newTx = new Transaction();

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: priorityFees.unitLimit,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFees.unitPrice,
    });
    newTx.add(modifyComputeUnits);
    newTx.add(addPriorityFee);

    return newTx;
}

exports.getVersionedTransaction = async (
    connection,
    ownerPubkey,
    instructionArray,
    lookupTableAccount = null
) => {
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    // console.log("recentBlockhash", recentBlockhash);

    const messageV0 = new TransactionMessage({
        payerKey: ownerPubkey,
        instructions: instructionArray,
        recentBlockhash: recentBlockhash,
    }).compileToV0Message(lookupTableAccount ? lookupTableAccount : undefined);

    return new VersionedTransaction(messageV0);
}

exports.getTipInstruction = async (payer, tip) => {
    try {
        const tipAccount = new PublicKey(getJitoTipAccount());
        const instruction = SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: tipAccount,
            lamports: LAMPORTS_PER_SOL * tip,
        });

        return instruction;
    } catch (err) {
        console.log(err);
    }
    return null;
}

exports.updateRecentBlockHash = async (connection, transactions, txs = []) => {
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    console.log("recentBlockhash", recentBlockhash);

    for (const transaction of transactions) {
        transaction.message.recentBlockhash = recentBlockhash;
    }

    if (txs.length > 0) {
        for (const transaction of txs) {
            transaction.message.recentBlockhash = recentBlockhash;
        }
    }
}

exports.createAddressLookupWithAddressList = async (
    connection,
    addressList,
    payer
) => {
    const slot = await connection.getSlot();
    const [lookupTableInst, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
            authority: payer.publicKey,
            payer: payer.publicKey,
            recentSlot: slot,
        });

    console.log("lookupTableAddress:", lookupTableAddress.toBase58());

    let idx = 0;
    const batchSize = 20;

    const instructions = [];

    instructions.push(lookupTableInst);

    while (idx < addressList.length) {
        const batch = addressList.slice(idx, idx + batchSize);

        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: payer.publicKey,
            authority: payer.publicKey,
            lookupTable: lookupTableAddress,
            addresses: batch,
        });

        instructions.push(extendInstruction);

        idx += batchSize;
    }

    let finalTxs = [];

    for (idx = 0; idx < instructions.length; idx++) {
        let tx;

        if (finalTxs.length == 0) {
            const jitoInstrunction = CreateTraderAPITipInstruction(payer.publicKey, this.JITO_TIP * LAMPORTS_PER_SOL);

            if (jitoInstrunction == null) {
                console.log("Can't get jito tip instruction");
                return lookupTableAddress;
            }

            tx = await this.getVersionedTransaction(connection, payer.publicKey, [
                instructions[idx],
                jitoInstrunction,
            ]);
        } else {
            tx = await this.getVersionedTransaction(connection, payer.publicKey, [
                instructions[idx],
            ]);
        }

        finalTxs.push(tx);

        if (finalTxs.length == BUNDLE_TX_LIMIT) {
            await this.updateRecentBlockHash(connection, finalTxs);

            for (const tx of finalTxs) {
                tx.sign([payer]);
            }
            const txHash = bs58.encode(finalTxs[0].signatures[0]);
            console.log("createAddressLookupWithAddressList txHash1 :>> ", txHash);
            const result = await buildBundleOnNBAndConfirmTxId(connection, finalTxs);
            if (result === false)
                return null;

            await sleep(500);
            finalTxs = [];
        }
    }

    if (finalTxs.length > 0) {
        await sleep(500);
        await this.updateRecentBlockHash(connection, finalTxs);

        for (const tx of finalTxs) {
            tx.sign([payer]);
        }
        const txHash = bs58.encode(finalTxs[0].signatures[0]);
        console.log("createAddressLookupWithAddressList txHash2 :>> ", txHash);
        await buildBundleOnNBAndConfirmTxId(connection, finalTxs);

        finalTxs = [];
    }

    return lookupTableAddress;
};

exports.registerAddressLookup = async (
    connection,
    poolInfo,
    wallets,
    payer,
    orgLookupTableAddress
) => {
    const poolKeys = jsonInfo2PoolKeys(poolInfo);
    const addressListFromPoolKey = [
        TOKEN_PROGRAM_ID,
        poolKeys.id,
        poolKeys.programId,
        poolKeys.authority,
        poolKeys.baseVault,
        poolKeys.quoteVault,
        poolKeys.openOrders,
        poolKeys.targetOrders,
        poolKeys.marketProgramId,
        poolKeys.marketId,
        poolKeys.marketAuthority,
        poolKeys.marketBaseVault,
        poolKeys.marketQuoteVault,
        poolKeys.marketBids,
        poolKeys.marketAsks,
        poolKeys.marketEventQueue,
    ];

    let firstAddressLookup;
    if (!orgLookupTableAddress || orgLookupTableAddress == "") {
        for (let idx = 0; idx < wallets.length; idx++) {
            const wallet = new PublicKey(wallets[idx]);
            const tokenAccount = await getAssociatedTokenAddress(
                poolKeys.baseMint,
                wallet
            );
            const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
            addressListFromPoolKey.push(wallet);
            addressListFromPoolKey.push(tokenAccount);
            addressListFromPoolKey.push(wrappedAccount);
        }

        firstAddressLookup = await this.createAddressLookupWithAddressList(
            connection,
            addressListFromPoolKey,
            payer
        );

        if (!firstAddressLookup) return null;
    } else {
        firstAddressLookup = new PublicKey(orgLookupTableAddress);
    }

    const lookupTableAccounts = [];

    const startTime = Date.now();
    const TIMEOUT = 20000;
    let lookupTableAccount = null;

    while (Date.now() - startTime < TIMEOUT) {
        console.log("---- verifing lookup Table", firstAddressLookup)
        lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

        if (lookupTableAccount.value && lookupTableAccount.value.state && lookupTableAccount.value.state.addresses.length >= addressListFromPoolKey.length) {
            console.log(`https://explorer.solana.com/address/${firstAddressLookup.toString()}/entries?cluster=mainnet`)
            break;
        }
        await sleep(1000)
    }

    lookupTableAccounts.push(lookupTableAccount.value);

    return lookupTableAccounts;
}

exports.buildTx = async (
    tx,
    payer,
    signers,
    latestBlockhash,
    priorityFees = null,
  ) => {
    try {
        let newTx = new Transaction();
    
        if (priorityFees) {
            const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: priorityFees.unitLimit,
            });
    
            const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFees.unitPrice,
            });
    
            newTx.add(modifyComputeUnits);
            newTx.add(addPriorityFee);
        }
    
        newTx.add(tx);

        let versionedTx = buildVersionedTx(
            payer,
            newTx,
            latestBlockhash,
        );
  
        versionedTx.sign(signers);
    
        return versionedTx;
    } catch (err) {
        console.log(`There are some errors in getting versioned transaction, ${err}`);
        return null;
    }
}

exports.buildVersionedTx = (
    payer,
    tx,
    latestBlockhash,
) => {
    const blockHash = latestBlockhash.blockhash;
  
    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockHash,
      instructions: tx.instructions,
    }).compileToV0Message();
  
    return new VersionedTransaction(messageV0);
};

exports.createAccounts = async (
    connection,
    lookupTableAccounts,
    wallets,
    token,
    buyAmounts,
    payer
) => {
    const instructions = [];
    const mint = new PublicKey(token);

    console.log(wallets, buyAmounts);

    const jitoInst = CreateTraderAPITipInstruction(payer.publicKey, this.JITO_TIP * LAMPORTS_PER_SOL);

    if (jitoInst == null) {
        console.log("Can't get jito fee instruction!");
        return null;
    }

    instructions.push(jitoInst);

    let instruction_ratio = 1;
    let idx = 0;
    for (const element of wallets) {
        const wallet = new PublicKey(element);
        const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
        if (!(await connection.getAccountInfo(tokenAccount))) {
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    tokenAccount,
                    wallet,
                    mint
                )
            );
        }

        const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
        if (!(await connection.getAccountInfo(wrappedAccount))) {
            instruction_ratio = 2.5
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    wrappedAccount,
                    wallet,
                    NATIVE_MINT
                )
            );

            instructions.push(
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: wrappedAccount,
                    lamports: buyAmounts[idx],
                })
            );
            instructions.push(createSyncNativeInstruction(wrappedAccount));
        } else {
            instructions.push(
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: wrappedAccount,
                    lamports: buyAmounts[idx],
                })
            );
            instructions.push(createSyncNativeInstruction(wrappedAccount));
        }

        if (idx % MAX_WALLET_PER_TX == 0) {
            console.log("createAccounts idx", idx);
            instructions.push(
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: wallet,
                    lamports: LAMPORTS_PER_SOL * 0.004,
                })
            );
        }

        idx++;
    }

    if (instructions.length == 1) {
        console.log("No need to create accounts");
        return false;
    }

    let finalTxs = [];

    console.log("total instruction count ", instructions.length);

    idx = 0;
    while (idx < instructions.length) {
        const batchInstrunction = instructions.slice(
            idx,
            idx + MAX_WALLET_PER_TX * instruction_ratio
        );
        // console.log("batchInstrunction", batchInstrunction);
        const tx = await this.getVersionedTransaction(
            connection,
            payer.publicKey,
            batchInstrunction,
            lookupTableAccounts
        );

        console.log("tx length", tx.serialize().length, idx);

        finalTxs.push(tx);
        idx += MAX_WALLET_PER_TX * instruction_ratio;

        if (finalTxs.length == 5) {
            await this.updateRecentBlockHash(connection, finalTxs);

            for (const tx of finalTxs) {
                tx.sign([payer]);
            }
            const txHash = bs58.encode(finalTxs[0].signatures[0]);
            console.log("createAccounts txHash1 :>> ", txHash);
            const result = await buildBundleOnNBAndConfirmTxId(connection, finalTxs);
            if (!result) return false;

            finalTxs = [];
            instructions.push(jitoInst);
        }
    }

    if (finalTxs.length >= 1) {
        await this.updateRecentBlockHash(connection, finalTxs);

        for (const tx of finalTxs) {
            tx.sign([payer]);
        }
        const txHash = bs58.encode(finalTxs[0].signatures[0]);
        console.log("createAccounts txHash2 :>> ", txHash);
        const result = await buildBundleOnNBAndConfirmTxId(connection, finalTxs);
        if (!result) return false;

        finalTxs = [];
    }

    return true;
}

exports.getBuyTokenInstructions = async (
    connection,
    poolKeys,
    tokenAddress,
    tokenDecimals,
    solAmount,
    tokenAmount,
    signerPubkey,
    tokenBase,
) => {
    try {
        let baseToken = new Token(TOKEN_PROGRAM_ID, tokenAddress, tokenDecimals);
        let quoteToken = new Token(
            TOKEN_PROGRAM_ID,
            "So11111111111111111111111111111111111111112",
            9
        );

        if (tokenBase == false) {
            quoteToken = new Token(TOKEN_PROGRAM_ID, tokenAddress, tokenDecimals);
            baseToken = new Token(
                TOKEN_PROGRAM_ID,
                "So11111111111111111111111111111111111111112",
                9
            );
        }

        let swapSolAmount = tokenBase
            ? new TokenAmount(quoteToken, solAmount, true)
            : new TokenAmount(baseToken, solAmount, true);

        let swapTokenAmount = tokenBase
            ? new TokenAmount(baseToken, new BN(tokenAmount))
            : new TokenAmount(quoteToken, new BN(tokenAmount));

        let walletTokenAccounts = [];
        {
            const allWalletTokenAccounts = await connection.getTokenAccountsByOwner(
                new PublicKey(signerPubkey),
                {
                    programId: TOKEN_PROGRAM_ID,
                }
            );

            const tokenAccounts = allWalletTokenAccounts.value;
            for (let i = 0; i < tokenAccounts.length; i++) {
                const accountInfo = SPL_ACCOUNT_LAYOUT.decode(
                    tokenAccounts[i].account.data
                );

                if (
                    accountInfo.mint.toString() != baseToken.mint.toString() &&
                    accountInfo.mint.toString() != quoteToken.mint.toString()
                )
                    continue;

                walletTokenAccounts.push({
                    pubkey: tokenAccounts[i].pubkey,
                    programId: tokenAccounts[i].account.owner,
                    accountInfo: accountInfo,
                });
            }
        }

        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
            connection: connection,
            poolKeys,
            userKeys: {
                tokenAccounts: walletTokenAccounts,
                owner: new PublicKey(signerPubkey),
            },
            amountIn: swapSolAmount,
            amountOut: new TokenAmount(baseToken, 1, false),
            // amountOut: swapTokenAmount,
            fixedSide: "in",
            // fixedSide: "out",
            makeTxVersion: TxVersion.V0,
        });

        // console.log("inst", innerTransactions[0].instructions);

        return innerTransactions[0].instructions;
    } catch (error) {
        console.log("    ERROR :", error);
        return null;
    }
};

exports.createPoolAndInitialBuy = async (
    connection,
    poolInfo,
    token,
    keypairs,
    solAmounts,
    tokenAmounts,
    signedTransactions,
    extraWallets,
    accounts,
    lookupTableAccounts,
    payer
) => {
    const poolKeys = jsonInfo2PoolKeys(poolInfo);
    const baseMint = new PublicKey(token);
    const baseMintInfo = await getMint(connection, baseMint);

    console.log(solAmounts, tokenAmounts)

    const finalTxs = [];
    let idxKeypair = 0;
    while (idxKeypair < keypairs.length) {
        const keypairSlices = keypairs.slice(
            idxKeypair,
            idxKeypair + MAX_WALLET_PER_TX
        );

        let instructions = [];

        for (let idx = 0; idx < keypairSlices.length; idx++) {
            let raydiumInstructions = [];
            console.log(solAmounts[idxKeypair + idx],
                tokenAmounts[idxKeypair + idx])

            while (1) {
                const result = await this.getBuyTokenInstructions(
                    connection,
                    poolKeys,
                    token,
                    baseMintInfo.decimals,
                    solAmounts[idxKeypair + idx],
                    tokenAmounts[idxKeypair + idx],
                    keypairSlices[idx].publicKey,
                    true
                );

                if (result !== null) {
                    raydiumInstructions = result;
                    break;
                }
            }

            const swapInstruction = raydiumInstructions[2];
            const wrappedAccount = await getAssociatedTokenAddress(
                NATIVE_MINT,
                keypairSlices[idx].publicKey
            );

            console.log(
                "raydiumInstructions",
                keypairSlices[idx].publicKey.toBase58(),
                wrappedAccount.toBase58(),
            );
            // console.log(swapInstruction)

            swapInstruction.keys[15].pubkey = wrappedAccount;

            instructions.push(swapInstruction)
            // instructions = [...instructions, ...raydiumInstructions]
        }

        // console.log(instructions)

        const tx = await this.getVersionedTransaction(
            connection,
            keypairSlices[0].publicKey,
            instructions,
            lookupTableAccounts
        );

        console.log(await connection.simulateTransaction(tx));

        finalTxs.push(tx);
        idxKeypair += MAX_WALLET_PER_TX;
    }

    let lastVerTxns = [];
    if (extraWallets.length > 0 && extraWallets[0]?.sim?.buy?.tokenAmount != "") {
        const baseToken = new Token(TOKEN_PROGRAM_ID, token, baseMintInfo.decimals);
        const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
        const baseAmount = new TokenAmount(baseToken, extraWallets[0].sim.buy.tokenAmount, true);
        const quoteAmount = new TokenAmount(quoteToken, extraWallets[0].sim.buy.solAmount, true);
        console.log(token, extraWallets[0].sim.buy.tokenAmount, extraWallets[0].sim.buy.solAmount, baseAmount, quoteAmount)

        let walletTokenAccount = null;
        try {
            walletTokenAccount = await this.getWalletTokenAccount(connection, accounts[extraWallets[0].address].publicKey);
        }
        catch (err) {
            console.log(err);
        }

        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
            connection,
            poolKeys,
            userKeys: {
                tokenAccounts: walletTokenAccount,
                owner: accounts[extraWallets[0].address].publicKey,
            },
            amountIn: quoteAmount,
            amountOut: new TokenAmount(baseToken, 1, false),
            fixedSide: 'in',
            makeTxVersion: TxVersion.V0,
        });
        /* Add Tip Instruction */
        // const tipAccount = new PublicKey(getJitoTipAccount());
        // let newInnerTransactions = [...innerTransactions];
        // if (newInnerTransactions.length > 0) {
        //     const p = newInnerTransactions.length - 1;

        //     newInnerTransactions[p].instructionTypes = [
        //         50,
        //         ...newInnerTransactions[p].instructionTypes,
        //     ];
        //     newInnerTransactions[p].instructions = [
        //         SystemProgram.transfer({
        //             fromPubkey: accounts[extraWallets[0].address].publicKey,
        //             toPubkey: tipAccount,
        //             lamports: LAMPORTS_PER_SOL * this.JITO_TIP * 2,
        //         }),
        //         ...newInnerTransactions[p].instructions,
        //     ];
        // }

        lastVerTxns = await buildSimpleTransaction({
            connection: connection,
            makeTxVersion: TxVersion.V0,
            payer: accounts[extraWallets[0].address].publicKey,
            innerTransactions: innerTransactions,
        });

        for (let j = 0; j < lastVerTxns.length; j++)
            lastVerTxns[j].sign([accounts[extraWallets[0].address]]);
    }

    // if (lastVerTxns.length == 0);
    // lastVerTxns.push(await getTipTrx(payer));
    
    await this.updateRecentBlockHash(connection, finalTxs);

    let idx = 0;
    for (const tx of finalTxs) {
        console.log("idx", idx);
        const keypairSlices = keypairs.slice(
            idx * MAX_WALLET_PER_TX,
            (idx + 1) * MAX_WALLET_PER_TX
        );
        tx.sign(keypairSlices);
        idx++;
    }

    const txHash = bs58.encode(finalTxs[0].signatures[0]);
    console.log("createPoolAndInitialBuy txHash :>> ", txHash);

    let verTxns = signedTransactions ? signedTransactions.map(tx => {
        return VersionedTransaction.deserialize(Buffer.from(tx, "base64"));
    }) : [];

    return await buildBundleOnNBAndConfirmTxId(connection, [...verTxns, ...finalTxs, ...lastVerTxns]);
}

exports.estimateOutputAmout = async (connection, poolInfo, mode, rawAmountIn, _slippage = 100) => {
    try {
        const poolKeys = jsonInfo2PoolKeys(poolInfo);

        let swapInDirection = false;
        if ((mode == "buy" && poolKeys.baseMint.toBase58() == NATIVE_MINT.toBase58()) || (mode == "sell" && poolKeys.quoteMint.toBase58() == NATIVE_MINT.toBase58()))
            swapInDirection = true;

        let fromPumpfun = await this.isFromPumpfun(connection, poolKeys.baseMint.toBase58());
        if (fromPumpfun) {
            swapInDirection = !swapInDirection
        }
        console.log(swapInDirection)

        const new_poolInfo = await Liquidity.fetchInfo({ connection, poolKeys })

        let currencyInMint = poolKeys.baseMint
        let currencyInDecimals = new_poolInfo.baseDecimals
        let currencyOutMint = poolKeys.quoteMint
        let currencyOutDecimals = new_poolInfo.quoteDecimals

        if (!swapInDirection) {
            currencyInMint = poolKeys.quoteMint
            currencyInDecimals = new_poolInfo.quoteDecimals
            currencyOutMint = poolKeys.baseMint
            currencyOutDecimals = new_poolInfo.baseDecimals
        }

        const currencyIn = new Token(TOKEN_PROGRAM_ID, currencyInMint, currencyInDecimals)
        const amountIn = new TokenAmount(currencyIn, rawAmountIn, false)
        const currencyOut = new Token(TOKEN_PROGRAM_ID, currencyOutMint, currencyOutDecimals)
        const slippage = new Percent(_slippage, 100) // 5% slippage

        const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = Liquidity.computeAmountOut({
            poolKeys,
            poolInfo: new_poolInfo,
            amountIn,
            currencyOut,
            slippage,
        })

        const amountOutRaw = minAmountOut.raw.toString();

        return { amountOut, minAmountOut }
    } catch (err) {
        console.log(err)
        return null
    }
}

exports.encryptId = (text) => {
    return aesEncrypt(text, process.env.CRYPT_KEY);
}

exports.decryptId = (text) => {
    return aesDecrypt(text, process.env.CRYPT_KEY);
}

exports.isOnRaydium = async (token) => {
    try {
        const url = `https://api.dexscreener.io/latest/dex/tokens/${token}`;
        const result = await axios.get(url, {
            headers: { "Content-Type": "application/json" },
        });

        if (result?.data?.pairs)
            return true;

    } catch (err) {
        console.log(err)
    }

    return false;
}

/**
 * Check if a token is from pump.fun by verifying the bonding curve account exists.
 * Pump.fun creates a bonding curve PDA for every launched token; this is the reliable signal.
 * Metaplex metadata is not used because many pump.fun tokens do not have a Metadata account.
 */
exports.isFromPumpfun = async (connection, token, isToken2022 = false) => {
    try {
        const mintAddress = new PublicKey(token);
        const pumpfunProgramId = new PublicKey(PUMPFUN_PROGRAM_ID);

        // Bonding curve PDA: seeds = ["bonding-curve", mint], program = pump.fun
        const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mintAddress.toBuffer()],
            pumpfunProgramId
        );

        const accountInfo = await connection.getAccountInfo(bondingCurvePDA);
        if (accountInfo && accountInfo.owner.equals(pumpfunProgramId)) {
            return true;
        }

        return false;
    } catch (err) {
        console.log('isFromPumpfun error', err?.message || err);
        return false;
    }
}

exports.extractStringFromBuffer = (buffer, offset, length) => {
    const slice = buffer.slice(offset, offset + length);
    return slice.toString('utf8').replace(/\0/g, '').trim(); // Remove null characters and trim whitespace
}