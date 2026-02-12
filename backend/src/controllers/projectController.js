"use strict";

const BigNumber = require("bignumber.js");
const json2csv = require("json2csv").parse;
const bs58 = require("bs58");
const BN = require("bn.js");
const axios = require("axios");
const {
    Keypair,
    PublicKey,
    Transaction,
    TransactionMessage,
    Connection,
    VersionedTransaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getMint,
    getAccount,
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction,
    createTransferCheckedInstruction,
    createCloseAccountInstruction,
    createThawAccountInstruction,
    createFreezeAccountInstruction,
    createSetAuthorityInstruction,
    AuthorityType,
    createBurnInstruction,
    createSyncNativeInstruction,
} = require("@solana/spl-token");
const {
    SYSTEM_PROGRAM_ID,
    MEMO_PROGRAM_ID,
    RENT_PROGRAM_ID,
    METADATA_PROGRAM_ID,
    INSTRUCTION_PROGRAM_ID,
    SYSVAR_RENT_PUBKEY,

    Liquidity,
    Percent,
    Token,
    TokenAmount,
    TxVersion,
    jsonInfo2PoolKeys,
    buildSimpleTransaction,
} = require('@raydium-io/raydium-sdk');
const {
    PROGRAM_ID,
    Metadata,
} = require("@metaplex-foundation/mpl-token-metadata");

const anchor = require("@coral-xyz/anchor");

const { programID, feeRecipient, EVENT_AUTH, DEFAULT_WALLET_AMOUNT, PAYMENT_OPTIONS, BUNDLE_TX_LIMIT } = require("../constants/index");
const logger = require("../utils/logger");
const idl = require("../constants/idl.json");
const Project = require("../models/projectModel");
const Wallet = require("../models/walletModel");
const Email = require("../models/emailModel");
const User = require("../models/userModel");
const LimitOrder = require("../models/limitOrderModel");
const { useConnection, rpcConfirmationExecute, simulateTxs, getPriorityUnitPrice, getSimulateMode, simulateBundle } = require("../utils/connection");
const { isValidAddress, createWallets, getBalance, registerAddressLookup, createAccounts, createPoolAndInitialBuy, estimateOutputAmout, createAddressLookupWithAddressList, isOnRaydium, getBuyTokenInstructions, extractStringFromBuffer, checkMigratedToPumpswap, buildTx, getPriorifyFeeTx, getPriorifyFeeIxs, JITO_TIP, pollTransactionStatuses } = require("../utils/common");
const { getSolAmountsSimulate, getPumpPoolKeys, buildMintTx, buildMintBuyTx, getSafeSolBalance, getKeypairFromBs58, getSafeTokenBalance, buildSellTx, buildBuyTx, calcTokenAmounts, buildMintIx, buildMintBuyIx, buildMintBuyTxLamports, buildMintBuyTxBuffer, buildSellTxBuffer, buildInitializeTx, buildBuyTxBufferContract, buildRecoverTx, buildBuyTxWithBuffer, buildSellTxWithBuffer } = require("../utils/pumpfun");
const { getTipAccounts, sendBundles, createAndSendBundleTransaction, useJitoTipAddr, getJitoTipAccount, sendBundleTrxWithTip, getTipTrx, jitoWithAxios, jitoWithSearcher, CreateJitoTipInstruction } = require("../utils/jito");
const { createLookupTable, makeVerTxWithLUT, addPoolKeysToTable, addPubKeysToTable, getLUTAccout, makeVerTx } = require("../utils/lookupTable");
// const { addLog } = require("../utils/log");

const {
    sleep,
    getRandomNumber,
    xWeiAmount,
    sendAndConfirmVersionedTransactions,
    sendAndConfirmLegacyTransactions,
    getWalletTokenAccount,
    getPoolInfo,
    getAllPubKeysInPoolKeys,
} = require("../utils/common");
const { getWebSocketClientList } = require("../utils/websocket");
const sendEmail = require("../utils/sendEmail");
const { simulateTransaction } = require("@project-serum/anchor/dist/cjs/utils/rpc");
const base58 = require("bs58");
const { getTaxWallet } = require("./adminController");
const { PumpKeyPair, BonkKeyPair } = require("../models/keyPairModel");
const { CurveCalculator, AMM_V4, CREATE_CPMM_POOL_PROGRAM } = require("@raydium-io/raydium-sdk-v2");
const { buildPumpSwapBuyTx, buildPumpSwapSellTx } = require("../utils/pumpswap");
const { buildBundlesOnBX, TRADER_API_TIP_WALLET, buildBlxrTipInstructions, buildBlxrTipTransaction } = require("../utils/bloxroute");
const { PumpSdk, getPumpProgram } = require("@pump-fun/pump-sdk");
const { CreateTraderAPITipInstruction, buildBundlesOnNB, buildNBTipTransaction, buildBundleOnNB, buildTxOnNB, buildBundleOnNBAndConfirmTxId } = require("../utils/astralane");
const { TransactionInstruction } = require("@solana/web3.js");
const { version } = require("mongoose");
const { ConnectedLeadersResponse_ConnectedValidatorsEntry } = require("jito-ts/dist/gen/block-engine/searcher");
const { connect } = require("http2");

let lookupTableAccountsForProject = {};

let pendingProjectIDs = [];
const doMonitor = async () => {
    console.log("Start monitoring for created project...");
    while (true) {
        let sleeping = true;
        const curTime = Date.now();
        for (let i = 0; i < pendingProjectIDs.length; i++) {
            const project = await Project.findById(pendingProjectIDs[i]);
            if (project) {
                if (project.status !== "INIT") {
                    console.log("Activated project:", project.name);
                    sleeping = false;
                    pendingProjectIDs = pendingProjectIDs.filter(item => item !== pendingProjectIDs[i]);
                    break;
                }

                if (curTime >= project.depositWallet.expireTime.getTime()) {
                    console.log("Expired project:", project.name);
                    project.status = "EXPIRED";
                    await project.save();

                    sleeping = false;
                    pendingProjectIDs = pendingProjectIDs.filter(item => item !== pendingProjectIDs[i]);
                    break;
                }

                try {
                    const { connection } = useConnection();
                    const balance = await connection.getBalance(new PublicKey(project.depositWallet.address));
                    const b1 = new BigNumber(balance.toString());
                    const b2 = new BigNumber("3e9"); // 3 SOL
                    if (b1.gte(b2)) {
                        console.log("Activated project:", project.name);
                        project.status = "OPEN";
                        await project.save();

                        // TODO: Transfer SOL from deposit wallet of project to hot wallet

                        sleeping = false;
                        pendingProjectIDs = pendingProjectIDs.filter(item => item !== pendingProjectIDs[i]);
                        break;
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
            else {
                sleeping = false;
                pendingProjectIDs = pendingProjectIDs.filter(item => item !== pendingProjectIDs[i]);
                break;
            }
        }

        if (sleeping)
            await sleep(10000);
    }
}
doMonitor();

const logToClients = (clients, message, isObject) => {
    console.log(message);
    for (let i = 0; i < clients.length; i++)
        clients[i].emit("INSPECT_LOG", isObject ? JSON.stringify(message) : message);
}

const getZombieWallet = async (project) => {
    try {
        if (!project.zombie || project.zombie === "")
            return null;

        const walletItem = await Wallet.findOne({ address: project.zombie });
        if (!walletItem)
            return null;

        const keypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
        return keypair;
    }
    catch (err) {
        console.log(err);
        return null;
    }
};

const getInitialTeamWallets = async (supply = 0) => {
    try {
        const whiteTeamWallets = process.env.WHITE_TEAM_LIST.split(",");
        const keypairs = whiteTeamWallets.map(item => Keypair.fromSecretKey(bs58.decode(item)));
        for (let i = 0; i < keypairs.length; i++) {
            const walletItem = await Wallet.findOne({ address: keypairs[i].publicKey.toBase58() });
            if (!walletItem) {
                await Wallet.create({
                    address: keypairs[i].publicKey.toBase58(),
                    privateKey: bs58.encode(keypairs[i].secretKey),
                    category: "team",
                    userId: "admin",
                });
            }
        }

        return keypairs.map(item => {
            return {
                address: item.publicKey.toBase58(),
                initialTokenAmount: supply == 0 ? "" : (supply / 100 * parseFloat(process.env.PERCENT_PER_TEAM_WALLET)).toString(),
                sim: {
                    disperseAmount: "",
                    buy: {
                        tokenAmount: "",
                        solAmount: "",
                    },
                    xfer: {
                        fromAddress: "",
                        tokenAmount: "",
                    }
                }
            };
        });
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

const getInitialExtraWallets = async () => {
    try {
        const whiteExtraWallets = process.env.WHITE_EXTRA_LIST.split(",");
        const keypairs = whiteExtraWallets.map(item => Keypair.fromSecretKey(bs58.decode(item)));
        for (let i = 0; i < keypairs.length; i++) {
            const walletItem = await Wallet.findOne({ address: keypairs[i].publicKey.toBase58() });
            if (!walletItem) {
                await Wallet.create({
                    address: keypairs[i].publicKey.toBase58(),
                    privateKey: bs58.encode(keypairs[i].secretKey),
                    category: "extra",
                    userId: "extra-whitelist",
                });
            }
        }

        return keypairs.map(item => {
            return {
                address: item.publicKey.toBase58(),
                initialTokenAmount: "",
                sim: {
                    disperseAmount: "",
                    buy: {
                        tokenAmount: "",
                        solAmount: "",
                    },
                    xfer: {
                        fromAddress: "",
                        tokenAmount: "",
                    }
                }
            };
        });
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

const updateTeamAndExtraWallets = async (teamWallets, extraWallets, mintInfo) => {
    const teamWalletCount = parseInt(process.env.TEAM_WALLET_COUNT);
    const amountWeiPerWallet = new BigNumber(mintInfo.supply.toString()).multipliedBy(new BigNumber(process.env.PERCENT_PER_TEAM_WALLET)).dividedBy(new BigNumber("100")).toFixed(0);
    let amountPerWallet = Number(new BigNumber(amountWeiPerWallet.toString() + "e-" + mintInfo.decimals).toFixed(0));
    console.log("======== amountPerWallet: ", amountPerWallet);
    if (teamWallets.length !== teamWalletCount) {
        if (teamWallets.length < teamWalletCount) {
            for (let i = teamWallets.length; i < teamWalletCount; i++) {
                console.log("Generating team wallets...", teamWallets.length, teamWalletCount);
                teamWallets = [
                    ...teamWallets,
                    {
                        address: "",
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                solAmount: "",
                                tokenAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    }
                ];
            }
        }
        else {
            const count = teamWallets.length - teamWalletCount;
            teamWallets.splice(teamWalletCount, count);
        }
    }

    for (let i = 0; i < teamWallets.length; i++) {
        const tokenAmount = amountPerWallet;
        teamWallets[i].initialTokenAmount = tokenAmount;
    }

    const extraAmountPerWallet = Math.floor(amountPerWallet);
    for (let i = 0; i < extraWallets.length; i++) {
        const tokenAmount = extraAmountPerWallet;
        extraWallets[i].initialTokenAmount = tokenAmount;
    }

    return { teamWallets, extraWallets };
}

exports.checkCreateProjectMode = async (req, res) => {
    // const {  } = req.body;
    console.log("Checking create project mode...", req.user.name);
    try {
        // const project = await Project.findById(projectId);
        res.status(200).json({
            success: true,
            createByOwner: parseInt(process.env.CREATE_PROJECT_BY_OWNER) > 0 ? true : false,
            activated: true,
        });
    } catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
};

exports.createProject = async (req, res) => {
    const { name, paymentId, address, platform } = req.body;
    console.log("Creating project...", req.user.name, name, paymentId, address);

    // if (Number(paymentId) > 0 && !isValidAddress(address)) {
    //     res.status(401).json({
    //         success: false,
    //         error: "The token address is required.",
    //     });
    //     return
    // } else if (Number(paymentId) > 0 && isValidAddress(address)) {
    //     if (platform != "pump.fun") {
    //         try {
    //             const mintPublicKey = new PublicKey(address);

    //             const { connection } = useConnection();

    //             // Attempt to fetch the mint account data
    //             const mintInfo = await getMint(connection, mintPublicKey);
    //         } catch (e) {
    //             console.log(`This token is invalid address on solana network`)
    //             res.status(401).json({
    //                 success: false,
    //                 error: "This token is invalid address on solana network.",
    //             });
    //             return;
    //         }
    //     }
    // }

    try {
        let project = await Project.findOne({ name, userId: req.user._id.toString() });
        if (project) {
            console.log("There already exists the project with the same name.");
            res.status(401).json({
                success: false,
                error: "There already exists the project with the same name.",
            });
            return;
        }

        const keypair = Keypair.generate();
        const wallet = await Wallet.create({
            address: keypair.publicKey.toBase58(),
            privateKey: bs58.encode(keypair.secretKey),
            category: "temporary",
            userId: "admin",
        });

        if (platform != "pump.fun") {
            const teamWallets = await getInitialTeamWallets(0);
            const extraWallets = await getInitialExtraWallets();
            project = await Project.create({
                name: name,
                platform: platform,
                token: {
                    address: address,
                    name: "",
                    symbol: "",
                    decimals: "",
                    totalSupply: "",
                    tokenUri: "",
                    privateKey: "",
                },
                poolInfo: {},
                zombie: "",
                wallets: [],
                teamWallets: teamWallets,
                extraWallets: extraWallets,
                // status: "INIT",
                status: "OPEN",
                depositWallet: {
                    address: wallet.address,
                    expireTime: new Date(Date.now() + 3600000) // 1 hours
                },
                userId: req.user._id.toString(),
                userName: req.user.name,
                paymentId: paymentId,
                timestamp: Date.now()
            });
        } else {
            const teamWallets = await getInitialTeamWallets(1000000000);
            const extraWallets = await getInitialExtraWallets();
            project = await Project.create({
                name: name,
                platform: platform,
                token: {
                    address: address,
                    name: "",
                    symbol: "",
                    decimals: "",
                    totalSupply: "",
                    tokenUri: "",
                    privateKey: "",
                },
                poolInfo: {},
                zombie: "",
                wallets: [],
                mirrorWallets: [],
                teamWallets: teamWallets,
                extraWallets: extraWallets,
                // status: "INIT",
                status: "OPEN",
                depositWallet: {
                    address: wallet.address,
                    expireTime: new Date(Date.now() + 3600000) // 1 hours
                },
                userId: req.user._id.toString(),
                userName: req.user.name,
                paymentId: paymentId,
                timestamp: Date.now()
            });
        }

        console.log("Project:", project.name);

        pendingProjectIDs = [
            ...pendingProjectIDs,
            project._id.toString(),
        ];

        const zombieKeypair = Keypair.generate();
        await Wallet.create({
            address: zombieKeypair.publicKey.toBase58(),
            privateKey: bs58.encode(zombieKeypair.secretKey),
            category: "zombie",
            userId: project.userId,
        });

        project.zombie = zombieKeypair.publicKey.toBase58();

        //// Create and add wallets of project (also add mirror wallets)
        const createdWallets = await createWallets(project._id, PAYMENT_OPTIONS[paymentId].walletLimit > DEFAULT_WALLET_AMOUNT ? DEFAULT_WALLET_AMOUNT : PAYMENT_OPTIONS[paymentId].walletLimit);
        const mirrorWallets = await createWallets(project._id, PAYMENT_OPTIONS[paymentId].walletLimit > DEFAULT_WALLET_AMOUNT ? DEFAULT_WALLET_AMOUNT : PAYMENT_OPTIONS[paymentId].walletLimit);

        for (let i = 0; i < createdWallets.length; i++) {
            project.wallets = [
                ...project.wallets,
                {
                    address: createdWallets[i].address,
                    initialTokenAmount: "",
                    sim: {
                        disperseAmount: "",
                        buy: {
                            tokenAmount: "",
                            solAmount: ""
                        },
                        xfer: {
                            fromAddress: "",
                            tokenAmount: ""
                        }
                    },

                },
            ];
        }

        for (let i = 0; i < mirrorWallets.length; i++) {
            project.mirrorWallets = [
                ...project.mirrorWallets,
                {
                    address: mirrorWallets[i].address,
                },
            ];
        }

        await project.save();

        getBalance(project, req.user.name, req.user.role)

        project = await Project.findById(project._id.toString(), { teamWallets: 0, extraWallets: 0, });
        res.status(200).json({
            success: true,
            project: {
                _id: project._id.toString(),
                name: project.name,
                token: project.token,
                platform: project.platform,
                wallets: project.wallets,
                teamWallets: project.teamWallets,
                status: project.status,
                depositWallet: project.depositWallet,
                userId: project.userId,
                userName: project.userName,
                // qrcode: QR_CODE,
                paymentId: project.paymentId,
                projectTokenAmount: PAYMENT_OPTIONS[paymentId].cash
            },
            expireTime: project.depositWallet.expireTime - new Date()
        });
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
}

exports.setTokenAddress = async (req, res) => {
    const { projectId, address, name, symbol, authority, interval, platform, wallet1, percent1, wallet2, percent2, customRpc, rewardCA } = req.body;
    console.log("Updating project...", projectId, address);

    if (!isValidAddress(address)) {
        res.status(401).json({
            success: false,
            error: "The token address is required.",
        });
        return
    } else {
        if (platform != "pump.fun" && platform != "pump.fun-ghost") {
            // try {
            //     const mintPublicKey = new PublicKey(address);

            //     const { connection } = useConnection();

            //     // const raydium = await initSdk(connection, new PublicKey(req.user.name), true);

            //     console.log(address)
            //     // Attempt to fetch the mint account data
            //     // let info = await raydium.token.getTokenInfo(address);
            //     // console.log(info)
            //     const mintInfo = await getMint(connection, new PublicKey(address));
            //     console.log('✅ Token exists!');
            //     console.log('Decimals:', mintInfo.decimals);
            //     console.log('Supply:', mintInfo.supply.toString());
            // } catch (e) {
            //     console.log(`This token is invalid address on solana network`, e)
            //     res.status(401).json({
            //         success: false,
            //         error: "This token is invalid address on solana network.",
            //     });
            //     return;
            // }
        }
    }

    try {
        const project = await Project.findById(projectId);
        if (!project) {
            console.log("Not found project!");
            res.status(404).json({
                success: false,
                error: "Not found project",
            });
            return;
        }

        if (
            req.user.role !== "admin" &&
            project.userId !== req.user._id.toString()
        ) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        if (platform != "pump.fun" && platform != "pump.fun-ghost" && platform != "raydium.launchlab") {
            project.token.address = address;
            project.token.name = name;
            project.token.symbol = symbol;
            if (platform == "token-2022") {
                try {
                    const keypair = Keypair.fromSecretKey(bs58.decode(authority));
                    const foundedWallet = await Wallet.findOne({ address: keypair.publicKey.toBase58() });
                    if (!foundedWallet) {
                        await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "authority",
                            userId: project.userId,
                        });
                    }
                    project.token.authority = keypair.publicKey.toBase58();

                    if (interval && interval != "") {
                        project.token.interval = Number(interval)
                    }

                    project.token.treasuries = []
                    if (wallet1 && wallet1 != "" && percent1 && percent1 != "" && Number(percent1) > 0 && Number(percent1) <= 100) {
                        project.token.treasuries.push({
                            address: wallet1,
                            percent: Number(percent1)
                        })
                    }

                    if (wallet2 && wallet2 != "" && percent2 && percent2 != "" && Number(percent2) > 0 && Number(percent2) <= 100) {
                        project.token.treasuries.push({
                            address: wallet2,
                            percent: Number(percent2)
                        })
                    }

                    if (customRpc && customRpc != "") {
                        project.token.customRpc = customRpc;
                    }

                    if (rewardCA && rewardCA != "") {
                        project.token.rewardCA = rewardCA
                    }
                } catch (err) {
                }
            }
        } else if (platform == 'raydium.launchlab') {
            const keyPairItem = await BonkKeyPair.findOne({ publicKey: address });
            project.token = {
                address: address,
                name: keyPairItem.name,
                symbol: keyPairItem.symbol,
                decimals: 6,
                totalSupply: "1000000000",
                tokenUri: keyPairItem.uri,
                privateKey: keyPairItem.privateKey,
                creatorLpFeeShare: keyPairItem.creatorLpFeeShare
            }

            keyPairItem.isUsed = true;
            await keyPairItem.save();
        } else {
            const keyPairItem = await PumpKeyPair.findOne({ publicKey: address });
            project.token = {
                address: address,
                name: keyPairItem.name,
                symbol: keyPairItem.symbol,
                decimals: 6,
                totalSupply: "1000000000",
                tokenUri: keyPairItem.uri,
                privateKey: keyPairItem.privateKey,
            }

            keyPairItem.isUsed = true;
            await keyPairItem.save();
        }
        await project.save();

        res.status(200).json({
            success: true,
            data: project.token
        });
        return;
    } catch (err) {
        console.log(err)
        res.status(401).json({
            success: false,
            error: "Failed to set token address"
        })
    }
}

exports.deleteProject = async (req, res) => {
    const { projectId } = req.body;
    console.log("Deleting project...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (!project) {
            console.log("Not found project!");
            res.status(404).json({
                success: false,
                error: "Not found project",
            });
            return;
        }

        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        await project.remove();

        let projects;
        if (req.user.role === "admin")
            projects = await Project.find({ role: { "$ne": "admin" } });
        else {
            projects = await Project.find(
                {
                    userId: req.user._id.toString()
                },
                {
                    teamWallets: 0,
                    extraWallets: 0,
                }
            );
        }

        res.status(200).json({
            success: true,
            projects: projects,
        });
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
}

exports.checkProject = async (req, res) => {
    const { projectId } = req.body;
    // console.log("Checking project...", req.user.name, projectId);
    try {
        const project = await Project.findById(projectId);
        if (project.status !== "INIT" && project.status !== "EXPIRED") {
            res.status(200).json({
                success: true,
                name: project.name,
                activated: true,
            });
        }
        else {
            res.status(200).json({
                success: false,
                name: project.name,
                expired: project.status === "EXPIRED",
                expireTime: project.depositWallet.expireTime - new Date()
            });
        }
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
}

exports.activateProject = async (req, res) => {
    const { projectId } = req.body;
    console.log("Activating project...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (project && project.status === "INIT") {
            project.status = "OPEN";
            await project.save();
        }

        const projects = await Project.find({ role: { "$ne": "admin" } });
        res.status(200).json({
            success: true,
            projects: projects,
        });
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
}

exports.loadAllProjects = async (req, res) => {
    console.log("Loading all projects...", req.user.name);
    try {
        let projects;
        if (req.user.role === "admin")
            projects = await Project.find();
        else {
            projects = await Project.find(
                {
                    "$and": [
                        { userId: req.user._id.toString() },
                        {
                            "$or": [
                                { status: "OPEN" },
                                { status: "PURCHASE" },
                                { status: "TRADE" }
                            ]
                        }
                    ]
                }
            );
        }
        console.log("Projects:", projects);

        res.status(200).json({
            success: true,
            projects: projects,
        });
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
        });
    }
}

exports.saveProject = async (req, res) => {
    const { projectId, token, zombie, wallets, platform } = req.body;
    console.log("Saving project...", projectId, token, platform);
    if (!projectId) {
        res.status(401).json({
            success: false,
            error: "Not set project id",
        });
        return;
    }

    try {
        const project = await Project.findById(projectId, { teamWallets: 0, extraWallets: 0 });
        if (project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        const { connection } = useConnection();

        project.token.address = token;
        if (platform === 'raydium') {
            if (!project.poolInfo || project.poolInfo.baseMint !== token)
                project.poolInfo = await getPoolInfo(connection, token);
        }

        if (isValidAddress(token)) {
            const mint = new PublicKey(token);

            try {
                const mintInfo = await getMint(connection, mint);
                const [metadataPDA] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("metadata"),
                        PROGRAM_ID.toBuffer(),
                        mint.toBuffer()
                    ],
                    PROGRAM_ID
                );

                project.token.decimals = mintInfo.decimals.toString();
                project.token.totalSupply = Number(new BigNumber(mintInfo.supply.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(0);

                try {
                    const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
                    console.log(metadata.data.name);
                    const tNames = metadata.data.name.split('\0');
                    const tSymbols = metadata.data.symbol.split('\0');
                    project.token.name = tNames[0];
                    project.token.symbol = tSymbols[0];
                }
                catch (err) {
                    // console.log(err);
                    project.token.name = "";
                    project.token.symbol = "";
                }

            }
            catch (err) {
                // console.log(err);
                // check this
                project.token.decimals = "6";
                project.token.totalSupply = "1000000000";
            }
        }

        project.zombie = zombie.address;
        if (zombie.privateKey !== "") {
            const keypair = Keypair.fromSecretKey(bs58.decode(zombie.privateKey));
            const walletItem = await Wallet.findOne({ address: keypair.publicKey.toBase58(), userId: project.userId });
            if (!walletItem) {
                await Wallet.create({
                    address: keypair.publicKey.toBase58(),
                    privateKey: bs58.encode(keypair.secretKey),
                    category: "zombie",
                    userId: project.userId,
                });
            }
        }

        for (let i = 0; i < wallets.length; i++) {
            for (let j = 0; j < project.wallets.length; j++) {
                if (wallets[i].address === project.wallets[j].address) {
                    project.wallets[j].initialTokenAmount = wallets[i].initialTokenAmount,
                        project.wallets[j].initialSolAmount = wallets[i].initialSolAmount;
                    break;
                }
            }
        }

        await project.save();

        res.status(200).json({
            success: true,
            project: project,
        });

        console.log("Success");
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.generateWallets = async (req, res) => {
    const { projectId, count, fresh } = req.body;
    console.log("Generating wallets...", projectId, count, fresh);
    try {
        const project = await Project.findById(projectId, { teamWallets: 0, extraWallets: 0 });
        if (project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        if (PAYMENT_OPTIONS[project.paymentId]?.walletLimit < 100) {
            res.status(201).json({
                success: false,
                error: "This project is limited to 10 wallets.",
            });
            return;
        }

        if (project.wallets.length > count)
            project.wallets.splice(count, project.wallets.length - count);
        else {
            const wallets = await Wallet.find({ userId: project.userId, category: "general" });
            let newWalletCount = count - project.wallets.length;
            if (!fresh) {
                let candWallets = [];
                for (let i = 0; i < wallets.length; i++) {
                    const matchedWallet = project.wallets.find(item => item.address === wallets[i].address);
                    if (!matchedWallet) {
                        candWallets.push({
                            address: wallets[i].address,
                            initialTokenAmount: "",
                            initialSolAmount: "",
                            sim: {
                                enabled: false,
                                disperseAmount: "",
                                buy: {
                                    tokenAmount: "",
                                    solAmount: "",
                                },
                                xfer: {
                                    fromAddress: "",
                                    tokenAmount: "",
                                }
                            }
                        });
                    }
                }

                if (candWallets.length > 0) {
                    const addedWalletCount = Math.min(candWallets.length, newWalletCount);
                    const addedWallets = candWallets.sort(() => 0.5 - Math.random()).slice(0, addedWalletCount);
                    console.log("Added Candidate Wallets:", addedWallets);
                    project.wallets = [
                        ...project.wallets,
                        ...addedWallets
                    ];
                    newWalletCount -= addedWalletCount;
                }
            }

            for (let i = 0; i < newWalletCount; i++) {
                const keypair = Keypair.generate();
                await Wallet.create({
                    address: keypair.publicKey.toBase58(),
                    privateKey: bs58.encode(keypair.secretKey),
                    category: "general",
                    userId: project.userId,
                });

                project.wallets = [
                    ...project.wallets,
                    {
                        address: keypair.publicKey.toBase58(),
                        initialTokenAmount: "",
                        initialSolAmount: "",
                        sim: {
                            enabled: false,
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    }
                ];
            }

            let necessaryMirrorWallets = []
            if (project.wallets.length - project.mirrorWallets.length > 0)
                necessaryMirrorWallets = await createWallets(project._id, project.wallets.length - project.mirrorWallets.length);

            if (necessaryMirrorWallets.length > 0) {
                for (let i = 0; i < necessaryMirrorWallets.length; i++) {
                    project.mirrorWallets.push({
                        address: necessaryMirrorWallets[i].address,
                    })
                }
            }
        }
        await project.save();

        res.status(200).json({
            success: true,
            project: project,
        });

        console.log("Success");
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.uploadWallets = async (req, res) => {
    const { projectId, privateKeys } = req.body;
    console.log("uploading wallets...", projectId);
    try {
        const project = await Project.findById(projectId, { teamWallets: 0, extraWallets: 0 });
        if (project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        let wallets = []
        for (let i = 0; i < privateKeys.length; i++) {
            try {
                console.log(privateKeys[i])
                const keypair = Keypair.fromSecretKey(bs58.decode(privateKeys[i]));

                const foundItem = await Wallet.findOne({ address: keypair.publicKey.toBase58() });
                if (!foundItem) {
                    await Wallet.create({
                        address: keypair.publicKey.toBase58(),
                        privateKey: bs58.encode(keypair.secretKey),
                        category: "uploaded",
                        userId: project.userId,
                    });
                }

                let isMatched = false;
                for (let i = 0; i < wallets.length; i++) {
                    if (wallets[i].address == keypair.publicKey.toBase58()) {
                        isMatched = true;
                        break;
                    }
                }

                for (let i = 0; i < project.wallets.length; i++) {
                    if (project.wallets[i].address == keypair.publicKey.toBase58()) {
                        isMatched = true;
                        break;
                    }
                }

                if (!isMatched) {
                    wallets.push({
                        address: keypair.publicKey.toBase58(),
                        initialTokenAmount: "",
                        initialSolAmount: "",
                        sim: {
                            enabled: false,
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    })
                }
            } catch (err) {
                console.log(err)
            }
        }

        project.wallets = [
            ...wallets,
            ...project.wallets,
        ];

        const mirrorWallets = await createWallets(project._id, wallets.length);
        let formattedMirrorWallets = []
        for (let i = 0; i < mirrorWallets.length; i++) {
            formattedMirrorWallets.push(
                {
                    address: mirrorWallets[i].address,
                }
            );
        }
        project.mirrorWallets = [
            ...formattedMirrorWallets,
            ...project.mirrorWallets
        ]

        await project.save();

        res.status(200).json({
            success: true,
            project: project,
        });

        console.log("Success");
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.downloadWallets = async (req, res) => {
    const { projectId } = req.body;
    console.log("Downloading wallets...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        let walletItems = [];
        for (let i = 0; i < project.wallets.length; i++) {
            const walletItem = await Wallet.findOne({ address: project.wallets[i].address, userId: project.userId });
            if (walletItem) {
                walletItems = [
                    ...walletItems,
                    {
                        address: walletItem.address,
                        privateKey: walletItem.privateKey,
                    }
                ];
            }
        }

        for (let i = 0; i < project.mirrorWallets.length; i++) {
            const walletItem = await Wallet.findOne({ address: project.mirrorWallets[i].address, userId: project.userId });
            if (walletItem) {
                walletItems = [
                    ...walletItems,
                    {
                        address: walletItem.address,
                        privateKey: walletItem.privateKey,
                    }
                ];
            }
        }

        if (req.user.role === "admin" && req.user.privilege == true) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
                if (walletItem) {
                    walletItems = [
                        ...walletItems,
                        {
                            address: walletItem.address,
                            privateKey: walletItem.privateKey,
                        }
                    ];
                }
            }
        }

        const csv = json2csv(walletItems);
        res.set("Content-Type", "text/csv");
        res.status(200).send(csv);

        console.log("Success");
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.collectAllSol = async (req, res) => {
    const { projectId, targetWallet, wallets, teamWallets } = req.body;
    console.log("Collecting all SOL...", projectId, targetWallet, wallets, teamWallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();
            const jitoTip = req.user.presets.jitoTip;
            const toPubkey = new PublicKey(targetWallet);
            const fee = new BN("1000000"); // 0.0009 SOL
            const tip = new BN(LAMPORTS_PER_SOL * jitoTip);

            const USE_JITO = true;
            if (USE_JITO) {
                let tWallets = [
                    ...wallets,
                ];

                for (let i = 0; i < wallets.length; i++) {
                    const index = project.wallets.findIndex((item) => item.address === wallets[i]);
                    if (index !== -1) {
                        tWallets.push(project.mirrorWallets[index].address);
                    }
                }

                if (teamWallets) {
                    tWallets = [
                        ...tWallets,
                        ...teamWallets,
                    ];
                }

                let accounts = {};
                for (let i = 0; i < tWallets.length; i++) {
                    const walletItem = await Wallet.findOne({ address: tWallets[i] });
                    if (!walletItem)
                        continue;

                    accounts[tWallets[i]] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }

                let bundleIndex = -1;
                let bundleItems = [];
                let index = 0;
                while (index < tWallets.length) {
                    let xfers = [];
                    let payer;
                    let count = 0;
                    while (index < tWallets.length) {
                        if (accounts[tWallets[index]]) {
                            const balance = new BN((await connection.getBalance(accounts[tWallets[index]].publicKey)).toString());
                            if (balance.gte(fee)) {
                                xfers.push({
                                    keypair: accounts[tWallets[index]],
                                    fromPubkey: accounts[tWallets[index]].publicKey,
                                    toPubkey: toPubkey,
                                    lamports: balance.sub(fee),
                                });
                                if (count === 0)
                                    payer = accounts[tWallets[index]].publicKey;
                                count++;
                            }
                        }
                        index++;
                        if (count >= 5)
                            break;
                    }

                    if (xfers.length > 0) {
                        console.log(`Transfer Instructions(${index - count}-${index - 1}):`, xfers.length);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                xfers,
                                payer,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    xfers,
                                    payer,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }
                }

                console.log("Bundle Items:", bundleItems.length);
                let passed = true;
                let bundleTxns = [];
                for (let i = 0; i < bundleItems.length; i++) {
                    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    const bundleItem = bundleItems[i];
                    // console.log("Bundle", i, bundleItem);
                    let tipPayer = null;
                    for (let j = 0; j < bundleItem.length; j++) {
                        for (let k = 0; k < bundleItem[j].xfers.length; k++) {
                            if (bundleItem[j].xfers[k].lamports.gte(tip)) {
                                tipPayer = bundleItem[j].xfers[k].keypair;
                                bundleItem[j].xfers[k].lamports = bundleItem[j].xfers[k].lamports.sub(tip);
                                break;
                            }
                        }
                        if (tipPayer)
                            break;
                    }

                    if (tipPayer) {
                        let verTxns = [];
                        for (let j = 0; j < bundleItem.length; j++) {
                            // let wallets = bundleItem[j].xfers.map(item => item.fromPubkey.toBase58());
                            let instructions = bundleItem[j].xfers.map(item => {
                                return SystemProgram.transfer({
                                    fromPubkey: item.fromPubkey,
                                    toPubkey: item.toPubkey,
                                    lamports: item.lamports.toString(),
                                });
                            });
                            let signers = bundleItem[j].xfers.map(item => item.keypair);
                            if (j === bundleItem.length - 1) {
                                instructions = [
                                    CreateTraderAPITipInstruction(tipPayer.publicKey, tip.toString()),
                                    ...instructions,
                                ];
                                signers = [
                                    tipPayer,
                                    ...signers,
                                ];
                            }

                            const transactionMessage = new TransactionMessage({
                                payerKey: bundleItem[j].payer,
                                instructions: instructions,
                                recentBlockhash,
                            });
                            const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                            tx.sign(signers);
                            verTxns.push(tx);
                        }
                        const ret = await buildBundleOnNB(verTxns);
                        if (!ret) {
                            passed = false;
                            break;
                        }

                        await sleep(1000);
                        // bundleTxns.push(verTxns);
                    }
                }

                // const ret = await buildBundlesOnNB(bundleTxns);
                if (!passed) {
                    logToClients(myClients, "Failed to collect all SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                let transactions = [];

                let tWallets = [
                    ...wallets,
                ];

                for (let i = 0; i < wallets.length; i++) {
                    const index = project.wallets.findIndex((item) => item.address === wallets[i]);
                    if (index !== -1) {
                        tWallets.push(project.mirrorWallets[index].address);
                    }
                }

                for (let i = 0; i < tWallets.length; i++) {
                    const walletItem = await Wallet.findOne({ address: tWallets[i], userId: project.userId });
                    if (!walletItem)
                        continue;

                    const keypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                    const balance = new BN((await connection.getBalance(keypair.publicKey)).toString());
                    if (balance.gte(fee)) {
                        const tx = new Transaction().add(
                            SystemProgram.transfer({
                                fromPubkey: keypair.publicKey,
                                toPubkey: toPubkey,
                                lamports: balance.sub(fee).toString(),
                            })
                        );

                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: [keypair],
                            }
                        ];
                    }
                }

                if (teamWallets) {
                    for (let i = 0; i < teamWallets.length; i++) {
                        const walletItem = await Wallet.findOne({ address: teamWallets[i] });
                        if (!walletItem)
                            continue;

                        const keypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                        const balance = new BN((await connection.getBalance(keypair.publicKey)).toString());
                        if (balance.gte(fee)) {
                            const tx = new Transaction().add(
                                SystemProgram.transfer({
                                    fromPubkey: keypair.publicKey,
                                    toPubkey: toPubkey,
                                    lamports: balance.sub(fee).toString(),
                                })
                            );

                            transactions = [
                                ...transactions,
                                {
                                    transaction: tx,
                                    signers: [keypair],
                                }
                            ];
                        }
                    }
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret)
                        console.log("Failed to collect all SOL");
                }
            }
            console.log("Success");

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.simulateBuyTokens = async (req, res) => {
    const { projectId, token, tokenAmount, solAmount, zombie, wallets } = req.body;
    console.log("Simulating...", projectId, token, tokenAmount, solAmount, wallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        for (let i = 0; i < wallets.length; i++) {
            const matched = project.wallets.find(item => item.address === wallets[i].address);
            if (!matched) {
                console.log("Mismatched wallets!");
                res.status(401).json({
                    success: false,
                    error: "Wallet mismatch",
                });
                return;
            }
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            let zombieWallet;
            if (zombie.privateKey !== "") {
                zombieWallet = Keypair.fromSecretKey(bs58.decode(zombie.privateKey));
                const walletItem = await Wallet.findOne({ address: zombieWallet.publicKey.toBase58() });
                if (!walletItem) {
                    await Wallet.create({
                        address: zombieWallet.publicKey.toBase58(),
                        privateKey: zombie.privateKey,
                        category: "zombie",
                        userId: project.userId,
                    });
                }
            }
            else
                zombieWallet = await getZombieWallet(project);

            if (!zombieWallet) {
                logToClients(myClients, "Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Zombie wallet not set" }));
                return;
            }

            const { connection } = useConnection();

            if (project.token.address !== token) {
                project.token.address = token;
                if (isValidAddress(token)) {
                    const mint = new PublicKey(token);
                    const mintInfo = await getMint(connection, mint);
                    const [metadataPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from("metadata"),
                            PROGRAM_ID.toBuffer(),
                            mint.toBuffer()
                        ],
                        PROGRAM_ID
                    );

                    try {
                        const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
                        const tNames = metadata.data.name.split('\0');
                        const tSymbols = metadata.data.symbol.split('\0');
                        project.token.name = tNames[0];
                        project.token.symbol = tSymbols[0];
                    }
                    catch (err) {
                        // console.log(err);
                        project.token.name = "";
                        project.token.symbol = "";
                    }

                    project.token.decimals = mintInfo.decimals.toString();
                    project.token.totalSupply = Number(new BigNumber(mintInfo.supply.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(0);
                }
            }
            if (!project.poolInfo || project.poolInfo.baseMint !== token)
                project.poolInfo = await getPoolInfo(connection, token);
            project.zombie = zombieWallet.publicKey.toBase58();
            console.log("Saving zombie address:", project.zombie);
            await project.save();

            if (!project.poolInfo || project.poolInfo.baseMint !== token) {
                logToClients(myClients, "Not created OpenBook market!", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Plesae create OpenBook market" }));
                return;
            }

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const mint = new PublicKey(token);
            const mintInfo = await getMint(connection, mint);

            const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
            const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
            const slippage = new Percent(10, 100);
            const poolKeys = jsonInfo2PoolKeys(project.poolInfo);
            let extraPoolInfo = {
                baseReserve: xWeiAmount(tokenAmount, mintInfo.decimals),
                quoteReserve: xWeiAmount(solAmount, 9),
            };

            logToClients(myClients, "Calculating sol amount to buy tokens...", false, project.extraWallets[0]);
            const { teamWallets, extraWallets } = await updateTeamAndExtraWallets(
                project.teamWallets.map((item) => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                project.extraWallets.map(item => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                mintInfo
            );

            const tWallets = wallets.map(item => {
                return {
                    address: item.address,
                    initialTokenAmount: item.initialTokenAmount.toString(),
                    initialSolAmount: item.initialSolAmount.toString(),
                    sim: {
                        enabled: true,
                        disperseAmount: "",
                        buy: {
                            tokenAmount: "",
                            solAmount: "",
                        },
                        xfer: {
                            fromAddress: "",
                            tokenAmount: "",
                        }
                    }
                };
            });

            let buyItemCount = 0;
            for (let i = 0; i < tWallets.length; i++) {
                const index = i % parseInt(process.env.BUNDLE_BUY_COUNT);
                if (project.paymentId == 1 && (Number(tWallets[i].initialTokenAmount) > parseFloat(new BigNumber(mintInfo.supply.toString() + 'e-' + (parseInt(mintInfo.decimals.toString()) + 2).toString())))) {
                    logToClients(myClients, "Invalid token amount", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Token amount per wallet must be less than 1% of total supply." }));
                    return;
                }

                if (tWallets[index].sim.buy.tokenAmount !== "") {
                    tWallets[index].sim.buy.tokenAmount += Number(tWallets[i].initialTokenAmount);
                }
                else {
                    tWallets[index].sim.buy.tokenAmount = Number(tWallets[i].initialTokenAmount);
                    if (buyItemCount == 0) {
                        const totalSupply = new BigNumber(mintInfo.supply.toString() + 'e-' + mintInfo.decimals.toString())
                        tWallets[index].sim.buy.tokenAmount += parseFloat(totalSupply.toString()) * PAYMENT_OPTIONS[project.paymentId].token / 100;
                    }
                    buyItemCount++;
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < teamWallets.length; i++) {
                const index = i % buyItemCount;
                tWallets[index].sim.buy.tokenAmount += Number(teamWallets[i].initialTokenAmount);
            }

            for (let i = 0; i < extraWallets.length; i++) {
                extraWallets[i].sim.buy.tokenAmount = Number(extraWallets[i].initialTokenAmount);
            }
            // }

            for (let i = 0; i < buyItemCount; i++) {
                const baseTokenAmount = new TokenAmount(baseToken, tWallets[i].sim.buy.tokenAmount.toString(), false);

                console.log("poolKeys: ", poolKeys)
                console.log("extraPoolInfo: ", extraPoolInfo)
                console.log("baseTokenAmount: ", baseTokenAmount)
                console.log("quoteToken: ", quoteToken)
                console.log("slippage: ", slippage)

                const { maxAmountIn: maxQuoteTokenAmount, amountIn } = Liquidity.computeAmountIn({
                    poolKeys: poolKeys,
                    poolInfo: extraPoolInfo,
                    amountOut: baseTokenAmount,
                    currencyIn: quoteToken,
                    slippage: slippage,
                });

                tWallets[i].sim.buy.tokenAmount = baseTokenAmount.raw.toString();
                // tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();
                tWallets[i].sim.buy.solAmount = amountIn.raw.toString();

                extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(baseTokenAmount.raw);
                // extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
                extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(amountIn.raw);
            }

            for (let i = 0; i < extraWallets.length; i++) {
                const baseTokenAmount = new TokenAmount(baseToken, extraWallets[i].sim.buy.tokenAmount.toString(), false);

                console.log("poolKeys: ", poolKeys)
                console.log("extraPoolInfo: ", extraPoolInfo)
                console.log("baseTokenAmount: ", baseTokenAmount)
                console.log("quoteToken: ", quoteToken)
                console.log("slippage: ", slippage)

                const { maxAmountIn: maxQuoteTokenAmount, amountIn } = Liquidity.computeAmountIn({
                    poolKeys: poolKeys,
                    poolInfo: extraPoolInfo,
                    amountOut: baseTokenAmount,
                    currencyIn: quoteToken,
                    slippage: slippage,
                });

                const balance = await connection.getBalance(new PublicKey(extraWallets[i].address))
                let newAmountIn = amountIn;
                let newBaseTokenAmount = baseTokenAmount;
                if (Number(balance.toString()) / LAMPORTS_PER_SOL - 0.02 < Number(amountIn.raw.toString()) / LAMPORTS_PER_SOL) {
                    newAmountIn = new TokenAmount(quoteToken, (Number(balance.toString()) / LAMPORTS_PER_SOL - 0.02).toString(), false);
                    const { amountOut } = Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: extraPoolInfo,
                        amountIn: newAmountIn,
                        currencyOut: baseToken,
                        slippage: slippage,
                    })
                    newBaseTokenAmount = amountOut;
                }

                extraWallets[i].sim.buy.tokenAmount = newBaseTokenAmount.raw.toString();
                // tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();
                extraWallets[i].sim.buy.solAmount = newAmountIn.raw.toString();

                if (Number(balance.toString()) / LAMPORTS_PER_SOL < 0.1) {
                    extraWallets[i].sim.buy.tokenAmount = "";
                    extraWallets[i].sim.buy.solAmount = "";
                    continue;
                }

                extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(newBaseTokenAmount.raw);
                // extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
                extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(newAmountIn.raw);
            }

            for (let i = 0; i < tWallets.length; i++) {
                const index = i % buyItemCount;
                const baseTokenAmount = new TokenAmount(baseToken, tWallets[i].initialTokenAmount.toString(), false);
                tWallets[i].sim.xfer = {
                    fromAddress: tWallets[index].address,
                    tokenAmount: baseTokenAmount.raw.toString(),
                };
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < teamWallets.length; i++) {
                const index = i % buyItemCount;
                const baseTokenAmount = new TokenAmount(baseToken, teamWallets[i].initialTokenAmount.toString(), false);
                teamWallets[i].sim.xfer = {
                    fromAddress: tWallets[index].address,
                    tokenAmount: baseTokenAmount.raw.toString(),
                };
            }
            // }

            console.log("Saving team wallets...");
            // if (project.paymentId != 1) {
            if (project.teamWallets.length !== teamWallets.length) {
                if (project.teamWallets.length < teamWallets.length) {
                    for (let i = project.teamWallets.length; i < teamWallets.length; i++) {
                        const keypair = Keypair.generate();
                        project.teamWallets = [
                            ...project.teamWallets,
                            {
                                address: keypair.publicKey.toBase58(),
                                initialTokenAmount: "",
                                sim: {
                                    disperseAmount: "",
                                    buy: {
                                        solAmount: "",
                                        tokenAmount: "",
                                    },
                                    xfer: {
                                        fromAddress: "",
                                        tokenAmount: "",
                                    }
                                }
                            }
                        ];
                        await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "team",
                            userId: "admin",
                        });
                    }
                }
                else {
                    const count = project.teamWallets.length - teamWallets.length;
                    project.teamWallets.splice(teamWallets.length, count);
                }
            }
            for (let i = 0; i < project.teamWallets.length; i++) {
                project.teamWallets[i].initialTokenAmount = teamWallets[i].initialTokenAmount;
                project.teamWallets[i].sim = {
                    disperseAmount: "",
                    buy: teamWallets[i].sim.buy,
                    xfer: teamWallets[i].sim.xfer,
                };
                // console.log("Team Wallet:", i, project.teamWallets[i]);
            }

            if (project.extraWallets.length !== extraWallets.length) {
                if (project.extraWallets.length < extraWallets.length) {
                    for (let i = project.extraWallets.length; i < extraWallets.length; i++) {
                        const keypair = Keypair.generate();
                        project.extraWallets = [
                            ...project.extraWallets,
                            {
                                address: keypair.publicKey.toBase58(),
                                initialTokenAmount: "",
                                sim: {
                                    disperseAmount: "",
                                    buy: {
                                        solAmount: "",
                                        tokenAmount: "",
                                    },
                                    xfer: {
                                        fromAddress: "",
                                        tokenAmount: "",
                                    }
                                }
                            }
                        ];
                        await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "team",
                            userId: "admin",
                        });
                    }
                }
                else {
                    const count = project.extraWallets.length - extraWallets.length;
                    project.extraWallets.splice(extraWallets.length, count);
                }
            }
            for (let i = 0; i < project.extraWallets.length; i++) {
                project.extraWallets[i].initialTokenAmount = extraWallets[i].initialTokenAmount;
                project.extraWallets[i].sim = {
                    disperseAmount: "",
                    buy: extraWallets[i].sim.buy,
                };
            }
            // }
            await project.save();

            logToClients(myClients, "Calculating sol amount to disperse...", false);
            let createATASols = {};
            let totalAmount = new BN(0);

            const createLUTFee = new BN(0.04 * LAMPORTS_PER_SOL).add(new BN(LAMPORTS_PER_SOL * jitoTip * 2));
            const disperseFee = new BN(0.01 * LAMPORTS_PER_SOL);
            // const additionalSolPerWallet = new BN(process.env.PREDISPERSE_FEE_PER_WALLET * LAMPORTS_PER_SOL);
            const swapFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const transferFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const createATAFee = new BN(0.01 * LAMPORTS_PER_SOL);

            for (let i = 0; i < tWallets.length; i++) {
                const index = i % buyItemCount;
                const pubkey = new PublicKey(tWallets[i].address);
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        if (createATASols[index])
                            createATASols[index] = createATASols[index].add(createATAFee);
                        else
                            createATASols[index] = createATAFee;
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                const index = i % buyItemCount;
                const pubkey = new PublicKey(project.teamWallets[i].address);
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        if (createATASols[index])
                            createATASols[index] = createATASols[index].add(createATAFee);
                        else
                            createATASols[index] = createATAFee;
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
            // }

            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                const pubkey = new PublicKey(getTaxWallet());
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        createATASols[0] = createATASols[0].add(createATAFee);
                    }
                } catch (err) {
                    console.log(err);
                }
            }

            for (let i = 0; i < tWallets.length; i++) {
                const itemSolAmount = tWallets[i].initialSolAmount.replaceAll(" ", "").replaceAll(",", "");
                let amount = itemSolAmount !== "" ? xWeiAmount(itemSolAmount, 9).add(new BN(LAMPORTS_PER_SOL * jitoTip)) : new BN(LAMPORTS_PER_SOL * jitoTip);
                let needWSolAmount = new BN(0);
                if (i < buyItemCount) {
                    const solAmountToBuy = new BN(tWallets[i].sim.buy.solAmount);

                    const pubkey = new PublicKey(tWallets[i].address);
                    let wsolBalance;
                    try {
                        const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);
                        const nativeATAInfo = await getAccount(connection, nativeATA);
                        if (nativeATAInfo) {
                            wsolBalance = new BN(nativeATAInfo.amount.toString());
                        } else {
                            wsolBalance = new BN(0);
                        }
                    } catch (err) {
                        wsolBalance = new BN(0);
                    }

                    if (wsolBalance.gte(solAmountToBuy)) {
                        needWSolAmount = new BN(0);
                    } else {
                        needWSolAmount = solAmountToBuy.sub(wsolBalance);
                    }

                    amount = amount.add(swapFee);
                    if (createATASols[i])
                        amount = amount.add(createATASols[i]);
                    amount = amount.add(new BN(LAMPORTS_PER_SOL * jitoTip * 10));
                }
                else
                    amount = amount.add(transferFee);

                const pubkey = new PublicKey(tWallets[i].address);
                let balance = await connection.getBalance(pubkey);
                balance = new BN(balance.toString());
                if (amount.gt(balance))
                    amount = amount.sub(balance);
                else
                    amount = new BN(0);

                tWallets[i].sim.disperseAmount = amount.toString();
                totalAmount = totalAmount.add(amount).add(needWSolAmount);
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                const itemSolAmount = new BN(LAMPORTS_PER_SOL * 0.05);
                let amount = transferFee.add(itemSolAmount);
                const pubkey = new PublicKey(project.teamWallets[i].address);
                let balance = await connection.getBalance(pubkey);
                balance = new BN(balance.toString());
                if (amount.gt(balance))
                    amount = amount.sub(balance);
                else
                    amount = new BN(0);

                project.teamWallets[i].sim.disperseAmount = amount.toString();
                totalAmount = totalAmount.add(amount);
            }
            // }

            totalAmount = totalAmount.add(disperseFee).add(new BN(LAMPORTS_PER_SOL * 0.1));

            // for predisperse
            // const additionalSolToDisperse = new BN(LAMPORTS_PER_SOL * 0.2); //additionalSolPerWallet.mul(BN(wallets.length))
            // console.log("additionalSolToDisperse: ", additionalSolToDisperse);
            // totalAmount = totalAmount.add(additionalSolToDisperse);

            if (!project.lookupTableAddress || project.lookupTableAddress == "")
                totalAmount = totalAmount.add(createLUTFee);

            let zombieBalance = await connection.getBalance(zombieWallet.publicKey);
            zombieBalance = new BN(zombieBalance.toString());
            if (totalAmount.gt(zombieBalance))
                totalAmount = totalAmount.sub(zombieBalance);
            else
                totalAmount = new BN(0);

            // =============================================================================== //
            console.log("Saving changes...");
            for (let i = 0; i < project.wallets.length; i++)
                project.wallets[i].sim.enabled = false;
            for (let i = 0; i < tWallets.length; i++) {
                for (let j = 0; j < project.wallets.length; j++) {
                    if (tWallets[i].address === project.wallets[j].address) {
                        project.wallets[j].initialTokenAmount = tWallets[i].initialTokenAmount;
                        project.wallets[j].initialSolAmount = tWallets[i].initialSolAmount;
                        project.wallets[j].sim = tWallets[i].sim;
                        break;
                    }
                }
            }

            await project.save();

            const data = {
                projectId: project._id.toString(),
                token: project.token,
                tokenAmount: tokenAmount,
                solAmount: solAmount,
                poolInfo: project.poolInfo,
                zombie: { address: zombieWallet.publicKey.toBase58(), value: totalAmount.toString() },
                wallets: tWallets,
            };
            // console.log("Simulate Data:", data);
            console.log("Success");

            for (let k = 0; k < myClients.length; k++) {
                myClients[k].emit("SIMULATE_COMPLETED",
                    JSON.stringify({
                        message: "OK",
                        data: data,
                    })
                );
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.simulateFairBuyTokens = async (req, res) => {
    const { projectId, token, tokenAmount, solAmount, zombie, wallets } = req.body;
    console.log("Simulating...", projectId, token, tokenAmount, solAmount, wallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        for (let i = 0; i < wallets.length; i++) {
            const matched = project.wallets.find(item => item.address === wallets[i].address);
            if (!matched) {
                console.log("Mismatched wallets!");
                res.status(401).json({
                    success: false,
                    error: "Wallet mismatch",
                });
                return;
            }
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            let zombieWallet;
            if (zombie.privateKey !== "") {
                zombieWallet = Keypair.fromSecretKey(bs58.decode(zombie.privateKey));
                const walletItem = await Wallet.findOne({ address: zombieWallet.publicKey.toBase58() });
                if (!walletItem) {
                    await Wallet.create({
                        address: zombieWallet.publicKey.toBase58(),
                        privateKey: zombie.privateKey,
                        category: "zombie",
                        userId: project.userId,
                    });
                }
            }
            else
                zombieWallet = await getZombieWallet(project);

            if (!zombieWallet) {
                logToClients(myClients, "Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Zombie wallet not set" }));
                return;
            }

            const { connection } = useConnection();

            if (project.token.address !== token) {
                project.token.address = token;
                if (isValidAddress(token)) {
                    const mint = new PublicKey(token);
                    const mintInfo = await getMint(connection, mint);
                    const [metadataPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from("metadata"),
                            PROGRAM_ID.toBuffer(),
                            mint.toBuffer()
                        ],
                        PROGRAM_ID
                    );

                    try {
                        const metadata = await Metadata.fromAccountAddress(connection, metadataPDA);
                        const tNames = metadata.data.name.split('\0');
                        const tSymbols = metadata.data.symbol.split('\0');
                        project.token.name = tNames[0];
                        project.token.symbol = tSymbols[0];
                    }
                    catch (err) {
                        // console.log(err);
                        project.token.name = "";
                        project.token.symbol = "";
                    }

                    project.token.decimals = mintInfo.decimals.toString();
                    project.token.totalSupply = Number(new BigNumber(mintInfo.supply.toString() + "e-" + mintInfo.decimals.toString()).toString()).toFixed(0);
                }
            }
            if (!project.poolInfo || project.poolInfo.baseMint !== token)
                project.poolInfo = await getPoolInfo(connection, token);
            project.zombie = zombieWallet.publicKey.toBase58();
            console.log("Saving zombie address:", project.zombie);
            await project.save();

            if (!project.poolInfo || project.poolInfo.baseMint !== token) {
                logToClients(myClients, "Not created OpenBook market!", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Plesae create OpenBook market" }));
                return;
            }

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const mint = new PublicKey(token);
            const mintInfo = await getMint(connection, mint);

            const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
            const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
            const slippage = new Percent(10, 100);
            const poolKeys = jsonInfo2PoolKeys(project.poolInfo);
            let extraPoolInfo = {
                baseReserve: xWeiAmount(tokenAmount, mintInfo.decimals),
                quoteReserve: xWeiAmount(solAmount, 9),
            };
            project.initialTokenAmount = tokenAmount.toString();
            project.initialSolAmount = solAmount.toString();

            logToClients(myClients, "Calculating sol amount to buy tokens...", false, project.extraWallets[0]);
            const { teamWallets, extraWallets } = await updateTeamAndExtraWallets(
                project.teamWallets.map((item) => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                project.extraWallets.map(item => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                mintInfo
            );

            const tWallets = wallets.map(item => {
                return {
                    address: item.address,
                    initialTokenAmount: item.initialTokenAmount.toString(),
                    initialSolAmount: item.initialSolAmount.toString(),
                    sim: {
                        enabled: true,
                        disperseAmount: "",
                        buy: {
                            tokenAmount: "",
                            solAmount: "",
                        },
                        xfer: {
                            fromAddress: "",
                            tokenAmount: "",
                        }
                    }
                };
            });

            let buyItemCount = 0;
            for (let i = 0; i < tWallets.length; i++) {
                if (project.paymentId == 1 && (Number(tWallets[i].initialTokenAmount) > parseFloat(new BigNumber(mintInfo.supply.toString() + 'e-' + (parseInt(mintInfo.decimals.toString()) + 2).toString())))) {
                    logToClients(myClients, "Invalid token amount", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Token amount per wallet must be less than 1% of total supply." }));
                    return;
                }

                tWallets[i].sim.buy.tokenAmount = Number(tWallets[i].initialTokenAmount);
                if (i == 0) {
                    const totalSupply = new BigNumber(mintInfo.supply.toString() + 'e-' + mintInfo.decimals.toString())
                    tWallets[i].sim.buy.tokenAmount += parseFloat(totalSupply.toString()) * PAYMENT_OPTIONS[project.paymentId].token / 100;
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < teamWallets.length; i++) {
                teamWallets[i].sim.buy.tokenAmount = Number(teamWallets[i].initialTokenAmount);
            }

            for (let i = 0; i < extraWallets.length; i++) {
                extraWallets[i].sim.buy.tokenAmount = Number(extraWallets[i].initialTokenAmount);
            }
            // }

            for (let i = 0; i < tWallets.length; i++) {
                const baseTokenAmount = new TokenAmount(baseToken, tWallets[i].sim.buy.tokenAmount.toString(), false);

                console.log("poolKeys: ", poolKeys)
                console.log("extraPoolInfo: ", extraPoolInfo)
                console.log("baseTokenAmount: ", baseTokenAmount)
                console.log("quoteToken: ", quoteToken)
                console.log("slippage: ", slippage)

                const { maxAmountIn: maxQuoteTokenAmount, amountIn } = Liquidity.computeAmountIn({
                    poolKeys: poolKeys,
                    poolInfo: extraPoolInfo,
                    amountOut: baseTokenAmount,
                    currencyIn: quoteToken,
                    slippage: slippage,
                });

                tWallets[i].sim.buy.tokenAmount = baseTokenAmount.raw.toString();
                // tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();
                tWallets[i].sim.buy.solAmount = amountIn.raw.toString();

                extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(baseTokenAmount.raw);
                // extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
                extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(amountIn.raw);
            }

            for (let i = 0; i < teamWallets.length; i++) {
                const baseTokenAmount = new TokenAmount(baseToken, teamWallets[i].sim.buy.tokenAmount.toString(), false);

                console.log("poolKeys: ", poolKeys)
                console.log("extraPoolInfo: ", extraPoolInfo)
                console.log("baseTokenAmount: ", baseTokenAmount)
                console.log("quoteToken: ", quoteToken)
                console.log("slippage: ", slippage)

                const { maxAmountIn: maxQuoteTokenAmount, amountIn } = Liquidity.computeAmountIn({
                    poolKeys: poolKeys,
                    poolInfo: extraPoolInfo,
                    amountOut: baseTokenAmount,
                    currencyIn: quoteToken,
                    slippage: slippage,
                });

                teamWallets[i].sim.buy.tokenAmount = baseTokenAmount.raw.toString();
                // tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();
                teamWallets[i].sim.buy.solAmount = amountIn.raw.toString();

                extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(baseTokenAmount.raw);
                // extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
                extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(amountIn.raw);
            }

            for (let i = 0; i < extraWallets.length; i++) {
                const baseTokenAmount = new TokenAmount(baseToken, extraWallets[i].sim.buy.tokenAmount.toString(), false);

                console.log("poolKeys: ", poolKeys)
                console.log("extraPoolInfo: ", extraPoolInfo)
                console.log("baseTokenAmount: ", baseTokenAmount)
                console.log("quoteToken: ", quoteToken)
                console.log("slippage: ", slippage)

                const { maxAmountIn: maxQuoteTokenAmount, amountIn } = Liquidity.computeAmountIn({
                    poolKeys: poolKeys,
                    poolInfo: extraPoolInfo,
                    amountOut: baseTokenAmount,
                    currencyIn: quoteToken,
                    slippage: slippage,
                });

                const balance = await connection.getBalance(new PublicKey(extraWallets[i].address))
                let newAmountIn = amountIn;
                let newBaseTokenAmount = baseTokenAmount;
                if (Number(balance.toString()) / LAMPORTS_PER_SOL - 0.02 < Number(amountIn.raw.toString()) / LAMPORTS_PER_SOL) {
                    newAmountIn = new TokenAmount(quoteToken, (Number(balance.toString()) / LAMPORTS_PER_SOL - 0.02).toString(), false);
                    const { amountOut } = Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: extraPoolInfo,
                        amountIn: newAmountIn,
                        currencyOut: baseToken,
                        slippage: slippage,
                    })
                    newBaseTokenAmount = amountOut;
                }

                extraWallets[i].sim.buy.tokenAmount = newBaseTokenAmount.raw.toString();
                // tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();
                extraWallets[i].sim.buy.solAmount = newAmountIn.raw.toString();

                if (Number(balance.toString()) / LAMPORTS_PER_SOL < 0.1) {
                    extraWallets[i].sim.buy.tokenAmount = "";
                    extraWallets[i].sim.buy.solAmount = "";
                    continue;
                }

                extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(newBaseTokenAmount.raw);
                // extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
                extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(newAmountIn.raw);
            }

            console.log("Saving team wallets...");
            // if (project.paymentId != 1) {
            if (project.teamWallets.length !== teamWallets.length) {
                if (project.teamWallets.length < teamWallets.length) {
                    for (let i = project.teamWallets.length; i < teamWallets.length; i++) {
                        const keypair = Keypair.generate();
                        project.teamWallets = [
                            ...project.teamWallets,
                            {
                                address: keypair.publicKey.toBase58(),
                                initialTokenAmount: "",
                                sim: {
                                    disperseAmount: "",
                                    buy: {
                                        solAmount: "",
                                        tokenAmount: "",
                                    },
                                    xfer: {
                                        fromAddress: "",
                                        tokenAmount: "",
                                    }
                                }
                            }
                        ];
                        await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "team",
                            userId: "admin",
                        });
                    }
                }
                else {
                    const count = project.teamWallets.length - teamWallets.length;
                    project.teamWallets.splice(teamWallets.length, count);
                }
            }
            for (let i = 0; i < project.teamWallets.length; i++) {
                project.teamWallets[i].initialTokenAmount = teamWallets[i].initialTokenAmount;
                project.teamWallets[i].sim = {
                    disperseAmount: "",
                    buy: teamWallets[i].sim.buy,
                    xfer: teamWallets[i].sim.xfer,
                };
                // console.log("Team Wallet:", i, project.teamWallets[i]);
            }

            if (project.extraWallets.length !== extraWallets.length) {
                if (project.extraWallets.length < extraWallets.length) {
                    for (let i = project.extraWallets.length; i < extraWallets.length; i++) {
                        const keypair = Keypair.generate();
                        project.extraWallets = [
                            ...project.extraWallets,
                            {
                                address: keypair.publicKey.toBase58(),
                                initialTokenAmount: "",
                                sim: {
                                    disperseAmount: "",
                                    buy: {
                                        solAmount: "",
                                        tokenAmount: "",
                                    },
                                    xfer: {
                                        fromAddress: "",
                                        tokenAmount: "",
                                    }
                                }
                            }
                        ];
                        await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "team",
                            userId: "admin",
                        });
                    }
                }
                else {
                    const count = project.extraWallets.length - extraWallets.length;
                    project.extraWallets.splice(extraWallets.length, count);
                }
            }
            for (let i = 0; i < project.extraWallets.length; i++) {
                project.extraWallets[i].initialTokenAmount = extraWallets[i].initialTokenAmount;
                project.extraWallets[i].sim = {
                    disperseAmount: "",
                    buy: extraWallets[i].sim.buy,
                };
            }
            // }
            await project.save();

            logToClients(myClients, "Calculating sol amount to disperse...", false);
            let createATASols = {};
            let totalAmount = new BN(0);

            // const createLUTFee = new BN(0.04 * LAMPORTS_PER_SOL).add(new BN(LAMPORTS_PER_SOL * jitoTip * 2));
            const disperseFee = new BN(0.01 * LAMPORTS_PER_SOL);
            // const additionalSolPerWallet = new BN(process.env.PREDISPERSE_FEE_PER_WALLET * LAMPORTS_PER_SOL);
            const swapFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const transferFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const createATAFee = new BN(0.01 * LAMPORTS_PER_SOL);

            for (let i = 0; i < tWallets.length; i++) {
                const pubkey = new PublicKey(tWallets[i].address);
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        if (createATASols[i])
                            createATASols[i] = createATASols[i].add(createATAFee);
                        else
                            createATASols[i] = createATAFee;
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                const pubkey = new PublicKey(project.teamWallets[i].address);
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        if (createATASols[i])
                            createATASols[i] = createATASols[i].add(createATAFee);
                        else
                            createATASols[i] = createATAFee;
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
            // }

            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                const pubkey = new PublicKey(getTaxWallet());
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        createATASols[0] = createATASols[0].add(createATAFee);
                    }
                } catch (err) {
                    console.log(err);
                }
            }

            for (let i = 0; i < tWallets.length; i++) {
                const itemSolAmount = tWallets[i].initialSolAmount.replaceAll(" ", "").replaceAll(",", "");
                let amount = itemSolAmount !== "" ? xWeiAmount(itemSolAmount, 9).add(new BN(LAMPORTS_PER_SOL * jitoTip)) : new BN(LAMPORTS_PER_SOL * jitoTip);
                const solAmountToBuy = new BN(tWallets[i].sim.buy.solAmount);

                amount = amount.add(swapFee).add(solAmountToBuy);
                if (createATASols[i])
                    amount = amount.add(createATASols[i]);
                amount = amount.add(new BN(LAMPORTS_PER_SOL * jitoTip));

                const pubkey = new PublicKey(tWallets[i].address);
                let balance = await connection.getBalance(pubkey);
                balance = new BN(balance.toString());
                if (amount.gt(balance))
                    amount = amount.sub(balance);
                else
                    amount = new BN(0);

                tWallets[i].sim.disperseAmount = amount.toString();
                totalAmount = totalAmount.add(amount);
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                let amount = new BN(LAMPORTS_PER_SOL * jitoTip);
                const solAmountToBuy = new BN(project.teamWallets[i].sim.buy.solAmount);

                amount = amount.add(swapFee).add(solAmountToBuy);
                if (createATASols[i])
                    amount = amount.add(createATASols[i]);
                amount = amount.add(new BN(LAMPORTS_PER_SOL * jitoTip));

                const pubkey = new PublicKey(project.teamWallets[i].address);
                let balance = await connection.getBalance(pubkey);
                balance = new BN(balance.toString());
                if (amount.gt(balance))
                    amount = amount.sub(balance);
                else
                    amount = new BN(0);

                project.teamWallets[i].sim.disperseAmount = amount.toString();
                totalAmount = totalAmount.add(amount);
            }
            // }

            totalAmount = totalAmount.add(disperseFee).add(new BN(LAMPORTS_PER_SOL * 0.1));

            // for predisperse
            // const additionalSolToDisperse = new BN(LAMPORTS_PER_SOL * 0.2); //additionalSolPerWallet.mul(BN(wallets.length))
            // console.log("additionalSolToDisperse: ", additionalSolToDisperse);
            // totalAmount = totalAmount.add(additionalSolToDisperse);

            let zombieBalance = await connection.getBalance(zombieWallet.publicKey);
            zombieBalance = new BN(zombieBalance.toString());
            if (totalAmount.gt(zombieBalance))
                totalAmount = totalAmount.sub(zombieBalance);
            else
                totalAmount = new BN(0);

            // =============================================================================== //
            console.log("Saving changes...");
            for (let i = 0; i < project.wallets.length; i++)
                project.wallets[i].sim.enabled = false;
            for (let i = 0; i < tWallets.length; i++) {
                for (let j = 0; j < project.wallets.length; j++) {
                    if (tWallets[i].address === project.wallets[j].address) {
                        project.wallets[j].initialTokenAmount = tWallets[i].initialTokenAmount;
                        project.wallets[j].initialSolAmount = tWallets[i].initialSolAmount;
                        project.wallets[j].sim = tWallets[i].sim;
                        break;
                    }
                }
            }

            await project.save();

            const data = {
                projectId: project._id.toString(),
                token: project.token,
                tokenAmount: tokenAmount,
                solAmount: solAmount,
                poolInfo: project.poolInfo,
                zombie: { address: zombieWallet.publicKey.toBase58(), value: totalAmount.toString() },
                wallets: tWallets,
            };
            // console.log("Simulate Data:", data);
            console.log("Success");

            for (let k = 0; k < myClients.length; k++) {
                myClients[k].emit("SIMULATE_COMPLETED",
                    JSON.stringify({
                        message: "OK",
                        data: data,
                    })
                );
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}


// exports.simulateBuyPumpfunTokens = async (req, res) => {
//     const { projectId, token, tokenAmount, solAmount, zombie, wallets } = req.body;
//     console.log("Simulating...", projectId, token, tokenAmount, solAmount, wallets);
//     try {
//         const project = await Project.findById(projectId);
//         if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || project.status !== "OPEN") {
//             console.log("Mismatched user id!");
//             res.status(401).json({
//                 success: false,
//                 error: "User ID mismatch",
//             });
//             return;
//         }

//         for (let i = 0; i < wallets.length; i++) {
//             const matched = project.wallets.find(item => item.address === wallets[i].address);
//             if (!matched) {
//                 console.log("Mismatched wallets!");
//                 res.status(401).json({
//                     success: false,
//                     error: "Wallet mismatch",
//                 });
//                 return;
//             }
//         }

//         res.status(200).json({
//             success: true
//         });

//         const clients = getWebSocketClientList();
//         const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
//         try {
//             let zombieWallet;
//             if (zombie.privateKey !== "") {
//                 zombieWallet = Keypair.fromSecretKey(bs58.decode(zombie.privateKey));
//                 const walletItem = await Wallet.findOne({ address: zombieWallet.publicKey.toBase58() });
//                 if (!walletItem) {
//                     await Wallet.create({
//                         address: zombieWallet.publicKey.toBase58(),
//                         privateKey: zombie.privateKey,
//                         category: "zombie",
//                         userId: project.userId,
//                     });
//                 }
//             }
//             else
//                 zombieWallet = await getZombieWallet(project);

//             if (!zombieWallet) {
//                 logToClients(myClients, "Zombie wallet not set", false);
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Zombie wallet not set" }));
//                 return;
//             }

//             const { connection } = useConnection();

//             project.zombie = zombieWallet.publicKey.toBase58();
//             console.log("Saving zombie address:", project.zombie);
//             await project.save();

//             const jitoTip = req.user.presets.jitoTip;
//             console.log("Jito Tip:", jitoTip);

//             const mint = new PublicKey(token);
//             const mintInfo = {
//                 supply: "999990000",
//                 decimals: "0"//project.token.decimals
//             };

//             logToClients(myClients, "Calculating sol amount to buy tokens...", false, project.extraWallets[0]);
//             const { teamWallets, extraWallets } = await updateTeamAndExtraWallets(
//                 project.teamWallets.map(item => {
//                     return {
//                         address: item.address,
//                         initialTokenAmount: "",
//                         sim: {
//                             disperseAmount: "",
//                             buy: {
//                                 tokenAmount: "",
//                                 solAmount: "",
//                             },
//                             xfer: {
//                                 fromAddress: "",
//                                 tokenAmount: "",
//                             }
//                         }
//                     };
//                 }),
//                 project.extraWallets.map(item => {
//                     return {
//                         address: item.address,
//                         initialTokenAmount: "",
//                         sim: {
//                             disperseAmount: "",
//                             buy: {
//                                 tokenAmount: "",
//                                 solAmount: "",
//                             },
//                             xfer: {
//                                 fromAddress: "",
//                                 tokenAmount: "",
//                             }
//                         }
//                     };
//                 }),
//                 mintInfo
//             );

//             console.log("teamWallets", teamWallets, "extraWallets", extraWallets);

//             const tWallets = wallets.map(item => {
//                 return {
//                     address: item.address,
//                     initialTokenAmount: item.initialTokenAmount.toString(),
//                     initialSolAmount: item.initialSolAmount.toString(),
//                     sim: {
//                         enabled: true,
//                         disperseAmount: "",
//                         buy: {
//                             tokenAmount: "",
//                             solAmount: "",
//                         },
//                         xfer: {
//                             fromAddress: "",
//                             tokenAmount: "",
//                         }
//                     }
//                 };
//             });

//             let buyItemCount = 0;
//             const PUMP_TOKEN_LIMIT = 793100000;
//             let totalTokenAmount = 0;
//             totalTokenAmount = 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < teamWallets.length; i++) {
//                 // Check token amount overflow
//                 let initialTokenAmount = Number(teamWallets[i].initialTokenAmount);
//                 totalTokenAmount += initialTokenAmount;
//             }

//             for (let i = 0; i < extraWallets.length; i++) {
//                 // Check token amount overflow
//                 let initialTokenAmount = Number(extraWallets[i].initialTokenAmount);
//                 totalTokenAmount += initialTokenAmount;
//             }
//             // }

//             const PUMPFUN_BUNDLE_BUY_COUNT = parseInt(process.env.PUMPFUN_BUNDLE_BUY_COUNT);
//             for (let i = 0; i < tWallets.length; i++) {

//                 if (project.paymentId == 1) {
//                     if (i > 0) {
//                         if ((Number(tWallets[i].initialTokenAmount) > 10000000)) {
//                             logToClients(myClients, "Invalid token amount", false);
//                             for (let k = 0; k < myClients.length; k++)
//                                 myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Token amount per wallet must be less than 10000000." }));
//                             return;
//                         }
                       
//                     } else {
//                         let totalAmountExceptForDev = tWallets.slice(1, tWallets.length).reduce((acc, val) => acc + Number(val.initialTokenAmount), 0);
//                         const realDevTokenAmount = Number(tWallets[0].initialTokenAmount) - totalAmountExceptForDev;
//                         if (realDevTokenAmount > 10000000 || realDevTokenAmount <= 0) {
//                             logToClients(myClients, "Invalid token amount", false);
//                             for (let k = 0; k < myClients.length; k++)
//                                 myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Dev Real Trade Token Amount must be less than 10000000 or greater than 0." }));
//                             return;
//                         }
//                     }
//                 }

//                 // Check token amount overflow
//                 let initialTokenAmount = Number(tWallets[i].initialTokenAmount);
//                 let remainedTokenAmount = PUMP_TOKEN_LIMIT - totalTokenAmount;
//                 if (remainedTokenAmount < initialTokenAmount) {
//                     initialTokenAmount = remainedTokenAmount;
//                     tWallets[i].initialTokenAmount = initialTokenAmount.toString();
//                 }

//                 totalTokenAmount += initialTokenAmount;

//                 const index = i % PUMPFUN_BUNDLE_BUY_COUNT;
//                 if (tWallets[index].sim.buy.tokenAmount !== "") {
//                     tWallets[index].sim.buy.tokenAmount += initialTokenAmount;
//                 }
//                 else {
//                     tWallets[index].sim.buy.tokenAmount = initialTokenAmount;
//                     // if (buyItemCount == 0)
//                     //     tWallets[index].sim.buy.tokenAmount += 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;
//                     buyItemCount++;
//                 }
//             }

//             console.log("buyItemCount:", buyItemCount);

//             if (buyItemCount >= 2)
//                 tWallets[1].sim.buy.tokenAmount += 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;
//             else
//                 tWallets[0].sim.buy.tokenAmount += 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < teamWallets.length; i++) {
//                 let initialTokenAmount = Number(teamWallets[i].initialTokenAmount);

//                 const index = i % buyItemCount;
//                 if (buyItemCount >= 2)
//                     tWallets[index + 1].sim.buy.tokenAmount += initialTokenAmount;
//                 else
//                     tWallets[index].sim.buy.tokenAmount += initialTokenAmount;
//             }

//             for (let i = 0; i < extraWallets.length; i++) {
//                 let initialTokenAmount = Number(extraWallets[i].initialTokenAmount);
//                 extraWallets[i].sim.buy.tokenAmount = initialTokenAmount;
//             }
//             // }

//             // for (let i = 0; i < buyItemCount; i++) {
//             //     const baseTokenAmount = new TokenAmount(baseToken, tWallets[i].sim.buy.tokenAmount.toString(), false);
//             //     const { maxAmountIn: maxQuoteTokenAmount } = Liquidity.computeAmountIn({
//             //         poolKeys: poolKeys,
//             //         poolInfo: extraPoolInfo,
//             //         amountOut: baseTokenAmount,
//             //         currencyIn: quoteToken,
//             //         slippage: slippage,
//             //     });

//             //     tWallets[i].sim.buy.tokenAmount = baseTokenAmount.raw.toString();
//             //     tWallets[i].sim.buy.solAmount = maxQuoteTokenAmount.raw.toString();

//             //     extraPoolInfo.baseReserve = extraPoolInfo.baseReserve.sub(baseTokenAmount.raw);
//             //     extraPoolInfo.quoteReserve = extraPoolInfo.quoteReserve.add(maxQuoteTokenAmount.raw);
//             // }

//             let tokenAmounts = [];

//             for (let i = 0; i < tWallets.length; i++) {
//                 if (tWallets[i].sim.buy.tokenAmount !== "")
//                     tokenAmounts.push(tWallets[i].sim.buy.tokenAmount);
//             }

//             console.log("tokenAmounts", tokenAmounts);

//             // for (let i = 0; i < extraWallets.length; i++) {
//             //     if (extraWallets[i].sim.buy.tokenAmount !== "")
//             //         tokenAmounts.push(extraWallets[i].sim.buy.tokenAmount);
//             // }

//             const virtualInitSolReserve = 30.0;
//             const virtualInitTokenReserve = 1073000000;

//             const slippage = 10;

//             const solAmounts = await getSolAmountsSimulate(
//                 virtualInitSolReserve,
//                 virtualInitTokenReserve,
//                 tokenAmounts,
//                 extraWallets,
//                 slippage
//             );

//             let count = 0;
//             for (let i = 0; i < tWallets.length; i++) {
//                 if (tWallets[i].sim.buy.tokenAmount !== "") {
//                     tWallets[i].sim.buy.solAmount = solAmounts[count] * LAMPORTS_PER_SOL * (1 + slippage / 100);
//                     count++;
//                 }
//             }

//             for (let i = 0; i < extraWallets.length; i++) {
//                 if (extraWallets[i].sim.buy.tokenAmount !== "") {
//                     extraWallets[i].sim.buy.solAmount = solAmounts[count] * LAMPORTS_PER_SOL * (1 + slippage / 100);
//                     count++;
//                 }
//             }

//             for (let i = 0; i < tWallets.length; i++) {
//                 const index = i % buyItemCount;
//                 tWallets[i].sim.xfer = {
//                     fromAddress: tWallets[index].address,
//                     tokenAmount: tWallets[i].initialTokenAmount,
//                 };
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < teamWallets.length; i++) {
//                 const index = i % buyItemCount;
//                 if (buyItemCount >= 2)
//                     teamWallets[index].sim.xfer = {
//                         fromAddress: tWallets[index + 1].address,
//                         tokenAmount: teamWallets[i].initialTokenAmount.toString(),
//                     };
//                 else
//                     teamWallets[i].sim.xfer = {
//                         fromAddress: tWallets[index].address,
//                         tokenAmount: teamWallets[i].initialTokenAmount.toString(),
//                     };
//             }
//             // }

//             console.log("====== teamWallets.count ", teamWallets.length)

//             // if (project.paymentId != 1) {
//             if (project.teamWallets.length !== teamWallets.length) {
//                 if (project.teamWallets.length < teamWallets.length) {
//                     for (let i = project.teamWallets.length; i < teamWallets.length; i++) {
//                         const keypair = Keypair.generate();
//                         project.teamWallets = [
//                             ...project.teamWallets,
//                             {
//                                 address: keypair.publicKey.toBase58(),
//                                 initialTokenAmount: "",
//                                 sim: {
//                                     disperseAmount: "",
//                                     buy: {
//                                         solAmount: "",
//                                         tokenAmount: "",
//                                     },
//                                     xfer: {
//                                         fromAddress: "",
//                                         tokenAmount: "",
//                                     }
//                                 }
//                             }
//                         ];
//                         await Wallet.create({
//                             address: keypair.publicKey.toBase58(),
//                             privateKey: bs58.encode(keypair.secretKey),
//                             category: "team",
//                             userId: "admin",
//                         });
//                     }
//                 }
//                 else {
//                     const count = project.teamWallets.length - teamWallets.length;
//                     project.teamWallets.splice(teamWallets.length, count);
//                 }
//             }
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 project.teamWallets[i].initialTokenAmount = teamWallets[i].initialTokenAmount;
//                 project.teamWallets[i].sim = {
//                     disperseAmount: "",
//                     buy: teamWallets[i].sim.buy,
//                     xfer: teamWallets[i].sim.xfer,
//                 };
//                 // console.log("Team Wallet:", i, project.teamWallets[i]);
//             }

//             if (project.extraWallets.length !== extraWallets.length) {
//                 if (project.extraWallets.length < extraWallets.length) {
//                     for (let i = project.extraWallets.length; i < extraWallets.length; i++) {
//                         const keypair = Keypair.generate();
//                         project.extraWallets = [
//                             ...project.extraWallets,
//                             {
//                                 address: keypair.publicKey.toBase58(),
//                                 initialTokenAmount: "",
//                                 sim: {
//                                     disperseAmount: "",
//                                     buy: {
//                                         solAmount: "",
//                                         tokenAmount: "",
//                                     },
//                                     xfer: {
//                                         fromAddress: "",
//                                         tokenAmount: "",
//                                     }
//                                 }
//                             }
//                         ];
//                         await Wallet.create({
//                             address: keypair.publicKey.toBase58(),
//                             privateKey: bs58.encode(keypair.secretKey),
//                             category: "team",
//                             userId: "admin",
//                         });
//                     }
//                 }
//                 else {
//                     const count = project.extraWallets.length - extraWallets.length;
//                     project.extraWallets.splice(extraWallets.length, count);
//                 }
//             }
//             for (let i = 0; i < project.extraWallets.length; i++) {
//                 project.extraWallets[i].initialTokenAmount = extraWallets[i].initialTokenAmount;
//                 project.extraWallets[i].sim = {
//                     disperseAmount: "",
//                     buy: extraWallets[i].sim.buy,
//                 };
//             }

//             await project.save();
//             // }

//             logToClients(myClients, "Calculating sol amount to disperse...", false);
//             let createATASols = {};
//             let totalAmount = new BN(0);
//             const createLUTFee = new BN(0.006 * LAMPORTS_PER_SOL).add(new BN(LAMPORTS_PER_SOL * jitoTip * 2));
//             const disperseFee = new BN(0.01 * LAMPORTS_PER_SOL);
//             const swapFee = new BN(0.01 * LAMPORTS_PER_SOL);
//             const transferFee = new BN(0.01 * LAMPORTS_PER_SOL);
//             const createATAFee = new BN(0.01 * LAMPORTS_PER_SOL);
//             const pumpfunFee = new BN(0.02 * LAMPORTS_PER_SOL);
//             for (let i = 0; i < tWallets.length; i++) {
//                 const index = i % buyItemCount;

//                 if (createATASols[index])
//                     createATASols[index] = createATASols[index].add(createATAFee);
//                 else
//                     createATASols[index] = createATAFee;
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 const index = i % buyItemCount;
//                 const pubkey = new PublicKey(project.teamWallets[i].address);
//                 const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
//                 try {
//                     await sleep(20);
//                     const info = await connection.getAccountInfo(associatedToken);
//                     if (!info) {
//                         if (createATASols[index])
//                             createATASols[index] = createATASols[index].add(createATAFee);
//                         else
//                             createATASols[index] = createATAFee;
//                     }
//                 }
//                 catch (err) {
//                     console.log(err);
//                 }
//             }
//             // }

//             if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
//                 const pubkey = new PublicKey(getTaxWallet());
//                 const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
//                 try {
//                     await sleep(20);
//                     const info = await connection.getAccountInfo(associatedToken);
//                     if (!info) {
//                         if (buyItemCount >= 2)
//                             createATASols[1] = createATASols[1].add(createATAFee);
//                         else
//                             createATASols[0] = createATASols[0].add(createATAFee);
//                     }
//                 } catch (err) {
//                     console.log(err);
//                 }
//             }

//             for (let i = 0; i < tWallets.length; i++) {
//                 const itemSolAmount = tWallets[i].initialSolAmount.replaceAll(" ", "").replaceAll(",", "");
//                 let amount = itemSolAmount !== "" ? xWeiAmount(itemSolAmount, 9).add(new BN(LAMPORTS_PER_SOL * jitoTip)) : new BN(LAMPORTS_PER_SOL * jitoTip);

//                 if (i < buyItemCount) {
//                     const solAmountToBuy = new BN(tWallets[i].sim.buy.solAmount);
//                     amount = amount.add(swapFee).add(solAmountToBuy);
//                     if (createATASols[i])
//                         amount = amount.add(createATASols[i]);
//                     amount = amount.add(new BN(LAMPORTS_PER_SOL * jitoTip * 10));
//                 }
//                 else
//                     amount = amount.add(transferFee);

//                 const pubkey = new PublicKey(tWallets[i].address);
//                 await sleep(20);
//                 let balance = await connection.getBalance(pubkey);
//                 balance = new BN(balance.toString());
//                 if (amount.gt(balance))
//                     amount = amount.sub(balance);
//                 else
//                     amount = new BN(0);

//                 if (i === 0)
//                     amount = amount.add(pumpfunFee);

//                 tWallets[i].sim.disperseAmount = amount.toString();
//                 totalAmount = totalAmount.add(amount);
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 const itemSolAmount = new BN(LAMPORTS_PER_SOL * 0.05);
//                 let amount = transferFee.add(itemSolAmount);
//                 const pubkey = new PublicKey(project.teamWallets[i].address);
//                 await sleep(20);
//                 let balance = await connection.getBalance(pubkey);
//                 balance = new BN(balance.toString());
//                 if (amount.gt(balance))
//                     amount = amount.sub(balance);
//                 else
//                     amount = new BN(0);

//                 project.teamWallets[i].sim.disperseAmount = amount.toString();
//                 totalAmount = totalAmount.add(amount);
//             }
//             // }

//             totalAmount = totalAmount.add(disperseFee).add(new BN(LAMPORTS_PER_SOL * 0.1));
//             totalAmount = totalAmount.add(createLUTFee);
//             console.log("totalAmount ", totalAmount.toString())

//             let zombieBalance = await connection.getBalance(zombieWallet.publicKey);
//             zombieBalance = new BN(zombieBalance.toString());
//             if (totalAmount.gt(zombieBalance))
//                 totalAmount = totalAmount.sub(zombieBalance);
//             else
//                 totalAmount = new BN(0);

//             // =============================================================================== //
//             console.log("Saving changes...");
//             for (let i = 0; i < project.wallets.length; i++)
//                 project.wallets[i].sim.enabled = false;
//             for (let i = 0; i < tWallets.length; i++) {
//                 for (let j = 0; j < project.wallets.length; j++) {
//                     if (tWallets[i].address === project.wallets[j].address) {
//                         project.wallets[j].initialTokenAmount = tWallets[i].initialTokenAmount;
//                         project.wallets[j].initialSolAmount = tWallets[i].initialSolAmount;
//                         project.wallets[j].sim = tWallets[i].sim;
//                         break;
//                     }
//                 }
//             }

//             await project.save();

//             const data = {
//                 projectId: project._id.toString(),
//                 token: project.token,
//                 tokenAmount: tokenAmount,
//                 solAmount: solAmount,
//                 poolInfo: project.poolInfo,
//                 zombie: { address: zombieWallet.publicKey.toBase58(), value: totalAmount.toString() },
//                 wallets: tWallets,
//             };
//             // console.log("Simulate Data:", data);
//             console.log("Success");

//             for (let k = 0; k < myClients.length; k++) {
//                 myClients[k].emit("SIMULATE_COMPLETED",
//                     JSON.stringify({
//                         message: "OK",
//                         data: data,
//                     })
//                 );
//             }
//         }
//         catch (err) {
//             logToClients(myClients, err, true);
//             for (let k = 0; k < myClients.length; k++)
//                 myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed" }));
//         }
//     }
//     catch (err) {
//         console.log(err);
//         res.status(401).json({
//             success: false,
//             error: "Unknown error",
//         });
//     }
// }

exports.simulateBuyPumpfunTokens = async (req, res) => {
    const { projectId, token, tokenAmount, solAmount, zombie, wallets } = req.body;
    console.log("Simulating...", projectId, token, tokenAmount, solAmount, wallets);
    try {
        const project = await Project.findById(projectId);
        if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || project.status !== "OPEN") {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        for (let i = 0; i < wallets.length; i++) {
            const matched = project.wallets.find(item => item.address === wallets[i].address);
            if (!matched) {
                console.log("Mismatched wallets!");
                res.status(401).json({
                    success: false,
                    error: "Wallet mismatch",
                });
                return;
            }
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            let zombieWallet;
            if (zombie.privateKey !== "") {
                zombieWallet = Keypair.fromSecretKey(bs58.decode(zombie.privateKey));
                const walletItem = await Wallet.findOne({ address: zombieWallet.publicKey.toBase58() });
                if (!walletItem) {
                    await Wallet.create({
                        address: zombieWallet.publicKey.toBase58(),
                        privateKey: zombie.privateKey,
                        category: "zombie",
                        userId: project.userId,
                    });
                }
            }
            else
                zombieWallet = await getZombieWallet(project);

            if (!zombieWallet) {
                logToClients(myClients, "Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Zombie wallet not set" }));
                return;
            }

            const { connection } = useConnection();

            project.zombie = zombieWallet.publicKey.toBase58();
            console.log("Saving zombie address:", project.zombie);
            await project.save();

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const mint = new PublicKey(token);
            const mintInfo = {
                supply: "999990000",
                decimals: "0"//project.token.decimals
            };

            logToClients(myClients, "Calculating sol amount to buy tokens...", false, project.extraWallets[0]);
            const { teamWallets, extraWallets } = await updateTeamAndExtraWallets(
                project.teamWallets.map(item => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                project.extraWallets.map(item => {
                    return {
                        address: item.address,
                        initialTokenAmount: "",
                        sim: {
                            disperseAmount: "",
                            buy: {
                                tokenAmount: "",
                                solAmount: "",
                            },
                            xfer: {
                                fromAddress: "",
                                tokenAmount: "",
                            }
                        }
                    };
                }),
                mintInfo
            );

            console.log("teamWallets", teamWallets, "extraWallets", extraWallets);

            const tWallets = wallets.map(item => {
                return {
                    address: item.address,
                    initialTokenAmount: item.initialTokenAmount.toString(),
                    initialSolAmount: item.initialSolAmount.toString(),
                    sim: {
                        enabled: true,
                        disperseAmount: "",
                        buy: {
                            tokenAmount: "",
                            solAmount: "",
                        },
                        xfer: {
                            fromAddress: "",
                            tokenAmount: "",
                        }
                    }
                };
            });

            let buyItemCount = 0;
            const PUMP_TOKEN_LIMIT = 793100000;
            let totalTokenAmount = 0;
            // totalTokenAmount = 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;

            // if (project.paymentId != 1) {
            for (let i = 0; i < teamWallets.length; i++) {
                // Check token amount overflow
                let initialTokenAmount = Number(teamWallets[i].initialTokenAmount);
                totalTokenAmount += initialTokenAmount;
            }

            for (let i = 0; i < extraWallets.length; i++) {
                // Check token amount overflow
                let initialTokenAmount = Number(extraWallets[i].initialTokenAmount);
                totalTokenAmount += initialTokenAmount;
            }
            // }

            const PUMPFUN_BUNDLE_BUY_COUNT = parseInt(process.env.PUMPFUN_BUNDLE_BUY_COUNT);
            for (let i = 0; i < tWallets.length; i++) {

                if (project.paymentId == 1) {
                    if ((Number(tWallets[i].initialTokenAmount) > 10000000)) {
                        logToClients(myClients, "Invalid token amount", false);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Token amount per wallet must be less than 10000000." }));
                        return;
                    }
                    
                    // let totalAmountExceptForDev = tWallets.slice(1, tWallets.length).reduce((acc, val) => acc + Number(val.initialTokenAmount), 0);
                    // const realDevTokenAmount = Number(tWallets[0].initialTokenAmount) - totalAmountExceptForDev;
                    // if (realDevTokenAmount > 10000000 || realDevTokenAmount <= 0) {
                    //     logToClients(myClients, "Invalid token amount", false);
                    //     for (let k = 0; k < myClients.length; k++)
                    //         myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed", error: "Dev Real Trade Token Amount must be less than 10000000 or greater than 0." }));
                    //     return;
                    // }
                }

                // Check token amount overflow
                let initialTokenAmount = Number(tWallets[i].initialTokenAmount);
                let remainedTokenAmount = PUMP_TOKEN_LIMIT - totalTokenAmount;
                if (remainedTokenAmount < initialTokenAmount) {
                    initialTokenAmount = remainedTokenAmount;
                    tWallets[i].initialTokenAmount = initialTokenAmount.toString();
                }

                totalTokenAmount += initialTokenAmount;
                tWallets[i].sim.buy.tokenAmount = initialTokenAmount;
                   
            }

            console.log("buyItemCount:", buyItemCount);

            // if (tWallets.length >= 2)
            //     tWallets[1].sim.buy.tokenAmount += 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;
            // else
            //     tWallets[0].sim.buy.tokenAmount += 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100;

            let tokenAmounts = [];

            let index = 0;
            let allTokenAmount = 0;
            for (let i = 0; i < tWallets.length; i++) {
                if (tWallets[i].sim.buy.tokenAmount !== "") {
                    tokenAmounts.push(tWallets[i].sim.buy.tokenAmount);
                    if (!allTokenAmount) {
                        allTokenAmount = tWallets[i].sim.buy.tokenAmount;
                        index = i;
                    } else 
                        allTokenAmount += tWallets[i].sim.buy.tokenAmount;
                }
            }

            tWallets[index].sim.buy.tokenAmount = allTokenAmount

            console.log("tokenAmounts", tokenAmounts, "allTokenAmount", allTokenAmount);

            const virtualInitSolReserve = 30.0;
            const virtualInitTokenReserve = 1073000000;

            const slippage = 10;

            const solAmounts = await getSolAmountsSimulate(
                virtualInitSolReserve,
                virtualInitTokenReserve,
                tokenAmounts,
                extraWallets,
                slippage
            );

            let count = 0;
            for (let i = 0; i < tWallets.length; i++) {
                if (tWallets[i].sim.buy.tokenAmount !== "") {
                    tWallets[i].sim.buy.solAmount = Math.floor(solAmounts[count] * LAMPORTS_PER_SOL * (1 + slippage / 100));
                    count++;
                }
            }

            await project.save();
            // }

            logToClients(myClients, "Calculating sol amount to disperse...", false);
            let createATASols = {};
            let totalAmount = new BN(0);
            const createLUTFee = new BN(0.006 * LAMPORTS_PER_SOL).add(new BN(LAMPORTS_PER_SOL * jitoTip * 2));
            const disperseFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const swapFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const transferFee = new BN(0.01 * LAMPORTS_PER_SOL);
            const createATAFee = new BN(0.002 * LAMPORTS_PER_SOL);
            const pumpfunFee = new BN(0.02 * LAMPORTS_PER_SOL);
            for (let i = 0; i < tWallets.length; i++) {
                createATASols[i] = createATAFee;
            } 

            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                const pubkey = new PublicKey(getTaxWallet());
                const associatedToken = getAssociatedTokenAddressSync(mint, pubkey);
                try {
                    await sleep(20);
                    const info = await connection.getAccountInfo(associatedToken);
                    if (!info) {
                        if (buyItemCount >= 2)
                            createATASols[1] = createATASols[1].add(createATAFee);
                        else
                            createATASols[0] = createATASols[0].add(createATAFee);
                    }
                } catch (err) {
                    console.log(err);
                }
            }

            for (let i = 0; i < tWallets.length; i++) {
                const itemSolAmount = tWallets[i].initialSolAmount.replaceAll(" ", "").replaceAll(",", "");
                let amount = itemSolAmount !== "" ? xWeiAmount(itemSolAmount, 9).add(new BN(LAMPORTS_PER_SOL * jitoTip)) : new BN(LAMPORTS_PER_SOL * jitoTip);

                const solAmountToBuy = new BN(tWallets[i].sim.buy.solAmount);
                amount = amount.add(swapFee).add(solAmountToBuy);
                if (createATASols[i])
                    amount = amount.add(createATASols[i]);
                amount = amount.add(new BN(LAMPORTS_PER_SOL * jitoTip));

                if (i === 0)
                    amount = amount.add(pumpfunFee);

                console.log("index", i, "solAmount", amount.toString());


                tWallets[i].sim.disperseAmount = BigInt(Math.round(amount.toNumber())).toString();
                totalAmount = totalAmount.add(amount);
            }

            // totalAmount = totalAmount.add(disperseFee).add(new BN(LAMPORTS_PER_SOL * 0.1));
            totalAmount = totalAmount.add(disperseFee);
            // totalAmount = totalAmount.add(createLUTFee);
            console.log("totalAmount ", totalAmount.toString())

            let zombieBalance = await connection.getBalance(zombieWallet.publicKey);
            zombieBalance = new BN(zombieBalance.toString());
            if (totalAmount.gt(zombieBalance))
                totalAmount = totalAmount.sub(zombieBalance);
            else
                totalAmount = new BN(0);

            // =============================================================================== //
            console.log("Saving changes...");
            for (let i = 0; i < project.wallets.length; i++)
                project.wallets[i].sim.enabled = false;
            for (let i = 0; i < tWallets.length; i++) {
                for (let j = 0; j < project.wallets.length; j++) {
                    if (tWallets[i].address === project.wallets[j].address) {
                        project.wallets[j].initialTokenAmount = tWallets[i].initialTokenAmount;
                        project.wallets[j].initialSolAmount = tWallets[i].initialSolAmount;
                        project.wallets[j].sim = tWallets[i].sim;
                        break;
                    }
                }
            }

            await project.save();

            const data = {
                projectId: project._id.toString(),
                token: project.token,
                tokenAmount: tokenAmount,
                solAmount: solAmount,
                poolInfo: project.poolInfo,
                zombie: { address: zombieWallet.publicKey.toBase58(), value: totalAmount.toString() },
                wallets: tWallets,
            };
            // console.log("Simulate Data:", data);
            console.log("Success");

            for (let k = 0; k < myClients.length; k++) {
                myClients[k].emit("SIMULATE_COMPLETED",
                    JSON.stringify({
                        message: "OK",
                        data: data,
                    })
                );
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("SIMULATE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.preDisperseTokens = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Predispersing Tokens...");
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            const { connection } = useConnection();
            let addresses = [];
            let amounts = [];

            const mint = new PublicKey(simulateData.token.address);
            const mintInfo = await getMint(connection, mint);

            // Generate Random Token Amounts
            const associatedToken = getAssociatedTokenAddressSync(mint, zombieWallet.publicKey);
            let zombieTokenBalance = null;
            try {
                const tokenAccountInfo = await getAccount(connection, associatedToken);
                zombieTokenBalance = new BN(tokenAccountInfo.amount);
            }
            catch (err) {
                console.log(err);
            }

            const walletCount = simulateData.wallets.length;

            if (zombieTokenBalance.lt(new BN(10))) {
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }
            let totalDispersedTokenAmt = new BN(0);

            const _decimals = new BN(Math.pow(10, Number(project.token.decimals)));
            const _zombieAmount = zombieTokenBalance.div(_decimals);
            const _maxTokenAmount = _zombieAmount.div(new BN(walletCount - 1));
            const _minTokenAmount = _maxTokenAmount.mul(new BN(9)).div(new BN(10)); // 9/10
            const _maxAmount = Number(_maxTokenAmount.toString());
            const _minAmount = Number(_minTokenAmount.toString());

            for (let i = 0; i < simulateData.wallets.length; i++) {
                addresses.push(simulateData.wallets[i].address);
                if (i === simulateData.wallets.length - 1) {
                    amounts.push(zombieTokenBalance.sub(totalDispersedTokenAmt));
                }
                else {
                    let _tokenAmount = new BN(getRandomNumber(_minAmount, _maxAmount));
                    _tokenAmount = _tokenAmount.mul(_decimals);
                    totalDispersedTokenAmt = totalDispersedTokenAmt.add(_tokenAmount);
                    amounts.push(_tokenAmount);
                }
            }

            console.log("addresses: ", addresses)
            console.log("amounts: ", amounts.map(item => { return item.toString() }))

            // Randomize
            let rAddresses = [];
            let rAmounts = [];
            while (addresses.length > 0) {
                const randomIndex = getRandomNumber(0, addresses.length - 1);
                rAddresses.push(addresses[randomIndex]);
                rAmounts.push(amounts[randomIndex]);
                addresses.splice(randomIndex, 1);
                amounts.splice(randomIndex, 1);
            }

            const USE_JITO = true;
            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                console.log("Jito Tip:", jitoTip);

                const zero = new BN(0);
                let bundleIndex = -1;
                let bundleItems = [];

                const mint = new PublicKey(project.token.address);

                const signers = [zombieWallet];
                let index = 0;
                while (index < rAddresses.length) {
                    let count = 0;
                    let instructions = [];
                    for (let i = index; i < rAddresses.length; i++) {
                        const fromTokenAccount = getAssociatedTokenAddressSync(mint, zombieWallet.publicKey);
                        if (!fromTokenAccount)
                            continue;

                        const toTokenAccount = getAssociatedTokenAddressSync(mint, new PublicKey(rAddresses[i]));
                        try {
                            const info = await connection.getAccountInfo(toTokenAccount);
                            if (!info) {
                                instructions.push(
                                    createAssociatedTokenAccountInstruction(
                                        zombieWallet.publicKey,
                                        toTokenAccount,
                                        new PublicKey(rAddresses[i]),
                                        mint
                                    )
                                );
                            }
                        }
                        catch (err) {
                            console.log(err);
                        }

                        instructions.push(
                            createTransferInstruction(
                                fromTokenAccount,
                                toTokenAccount,
                                zombieWallet.publicKey,
                                rAmounts[i]
                            )
                        );

                        count++;
                        if (count >= 5)
                            break;
                    }

                    if (instructions.length > 0) {
                        console.log("Transferring tokens...", index, index + count - 1);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                signers: signers,
                                payer: zombieWallet.publicKey,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    signers: signers,
                                    payer: zombieWallet.publicKey,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }
                    else
                        break;

                    index += count;
                }

                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    let bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].payer, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);

                        const conn = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

                        // let simResult = await conn.simulateTransaction(tx);
                        // console.log("simResult: ", simResult)

                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    console.log("Failed to transfer tokens");

                    logToClients(myClients, "Failed to predisperse token", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            // else {
            //     const zero = new BN(0);
            //     let transactions = [];
            //     let index = 0;
            //     while (index < rAddresses.length) {
            //         let count = rAddresses.length - index;
            //         if (count > 15)
            //             count = 15;

            //         const tx = new Transaction();
            //         for (let i = index; i < index + count; i++) {
            //             const solAmount = new BN(rAmounts[i]);
            //             if (solAmount.gt(zero)) {
            //                 tx.add(
            //                     SystemProgram.transfer({
            //                         fromPubkey: zombieWallet.publicKey,
            //                         toPubkey: new PublicKey(rAddresses[i]),
            //                         lamports: rAmounts[i]
            //                     })
            //                 );
            //             }
            //         }

            //         if (tx.instructions.length > 0) {
            //             console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
            //             transactions = [
            //                 ...transactions,
            //                 {
            //                     transaction: tx,
            //                     signers: [zombieWallet],
            //                 }
            //             ];
            //         }

            //         index += count;
            //     }

            //     if (transactions.length > 0) {
            //         const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
            //         if (!ret) {
            //             logToClients(myClients, "Failed to disperse SOL", false);
            //             for (let k = 0; k < myClients.length; k++)
            //                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
            //             return;
            //         }
            //     }
            // }

            logToClients(myClients, "Success", false);
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("PREDISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

// exports.disperseSOLs = async (req, res) => {
//     const { simulateData } = req.body;
//     console.log("Dispersing SOL...", simulateData);
//     try {
//         const project = await Project.findById(simulateData.projectId);
//         if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
//             console.log("Mismatched user id or Not activated project!");
//             res.status(401).json({
//                 success: false,
//                 error: "User ID mismatch Or Not activated project",
//             });
//             return;
//         }

//         res.status(200).json({
//             success: true
//         });

//         const clients = getWebSocketClientList();
//         const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
//         try {
//             const { connection } = useConnection();

//             const zombieWallet = await getZombieWallet(project);
//             if (!zombieWallet) {
//                 logToClients(myClients, "ERROR: Zombie wallet not set", false);
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return;
//             }

//             if (!project.poolInfo || project.poolInfo.baseMint !== project.token.address) {
//                 let token = project.token.address;
//                 project.poolInfo = await getPoolInfo(connection, token);
//                 project.save();
//             }

//             let addresses = [];
//             let amounts = [];
//             let buyAddresses = [];
//             let buyAmounts = []
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
//                     addresses.push(simulateData.wallets[i].address);
//                     amounts.push(simulateData.wallets[i].sim.disperseAmount);
//                 }

//                 if (simulateData.wallets[i].sim.buy.solAmount !== "" && simulateData.wallets[i].sim.buy.solAmount !== "0") {
//                     const pubkey = new PublicKey(simulateData.wallets[i].address);
//                     const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);

//                     let wsolBalance;
//                     try {
//                         const nativeATAInfo = await getAccount(connection, nativeATA);
//                         if (nativeATAInfo) {
//                             wsolBalance = new BN(nativeATAInfo.amount.toString());
//                         } else {
//                             wsolBalance = new BN(0);
//                         }
//                     } catch (err) {
//                         wsolBalance = new BN(0);
//                     }

//                     const solAmountToBuy = new BN(simulateData.wallets[i].sim.buy.solAmount.toString());
//                     let needWSolAmount;
//                     if (wsolBalance.gte(solAmountToBuy)) {
//                         needWSolAmount = new BN(0);
//                     } else {
//                         needWSolAmount = solAmountToBuy.sub(wsolBalance);
//                     }

//                     buyAddresses.push(simulateData.wallets[i].address)
//                     buyAmounts.push(needWSolAmount.toString());
//                 }
//             }
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
//                     addresses.push(project.teamWallets[i].address);
//                     amounts.push(project.teamWallets[i].sim.disperseAmount);
//                     // buyAmounts.push(simulateData.teamWallets[i].sim.buy.solAmount);
//                 }

//                 try {
//                     if (simulateData.teamWallets[i].sim.buy.solAmount !== "" && simulateData.teamWallets[i].sim.buy.solAmount !== "0") {
//                         const pubkey = new PublicKey(simulateData.teamWallets[i].address);
//                         const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);
//                         let wsolBalance;
//                         try {
//                             const nativeATAInfo = await getAccount(connection, nativeATA);
//                             if (nativeATAInfo) {
//                                 wsolBalance = new BN(nativeATAInfo.amount.toString());
//                             } else {
//                                 wsolBalance = new BN(0);
//                             }
//                         } catch (err) {
//                             wsolBalance = new BN(0);
//                         }

//                         const solAmountToBuy = new BN(simulateData.teamWallets[i].sim.buy.solAmount.toString());
//                         let needWSolAmount;
//                         if (wsolBalance.gte(solAmountToBuy)) {
//                             needWSolAmount = new BN(0);
//                         } else {
//                             needWSolAmount = solAmountToBuy.sub(wsolBalance);
//                         }

//                         buyAddresses.push(simulateData.teamWallets[i].address)
//                         buyAmounts.push(needWSolAmount.toString());
//                     }
//                 } catch (err) {
//                     console.log("Error in dispersing sol to team wallets ===>", err)
//                 }
//             }

//             // Randomize
//             let rAddresses = [];
//             let rAmounts = [];
//             while (addresses.length > 0) {
//                 const randomIndex = getRandomNumber(0, addresses.length - 1);
//                 rAddresses.push(addresses[randomIndex]);
//                 rAmounts.push(amounts[randomIndex]);
//                 addresses.splice(randomIndex, 1);
//                 amounts.splice(randomIndex, 1);
//             }

//             const USE_JITO = true;
//             if (USE_JITO) {
//                 let lookupTableAccounts
//                 lookupTableAccounts = await registerAddressLookup(
//                     connection,
//                     project.poolInfo,
//                     buyAddresses,
//                     zombieWallet,
//                     project.lookupTableAddress
//                 );
//                 if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
//                     logToClients(myClients, "Failed to register Address Lookup.", false);
//                     for (let k = 0; k < myClients.length; k++)
//                         myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                     return false;
//                 }

//                 lookupTableAccountsForProject[project._id] = lookupTableAccounts;

//                 const ret0 = await createAccounts(
//                     connection,
//                     lookupTableAccounts,
//                     buyAddresses,
//                     project.token.address,
//                     buyAmounts,
//                     zombieWallet
//                 );

//                 if (!ret0) {
//                     logToClients(myClients, "Failed to disperse SOL", false);
//                     for (let k = 0; k < myClients.length; k++)
//                         myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                     return;
//                 }

//                 const jitoTip = req.user.presets.jitoTip;
//                 console.log("Jito Tip:", jitoTip);

//                 const zero = new BN(0);
//                 let bundleIndex = -1;
//                 let bundleItems = [];
//                 let index = 0;
//                 console.log("rAddresses: ", rAddresses)
//                 while (index < rAddresses.length) {
//                     let count = rAddresses.length - index;
//                     if (count > 15)
//                         count = 15;

//                     let instructions = [];
//                     for (let i = index; i < index + count; i++) {
//                         const solAmount = new BN(rAmounts[i]);
//                         if (solAmount.gt(zero)) {
//                             instructions.push(
//                                 SystemProgram.transfer({
//                                     fromPubkey: zombieWallet.publicKey,
//                                     toPubkey: new PublicKey(rAddresses[i]),
//                                     lamports: rAmounts[i]
//                                 })
//                             );
//                         }
//                     }

//                     if (instructions.length > 0) {
//                         console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
//                         if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < 5) {
//                             bundleItems[bundleIndex].push({
//                                 instructions: instructions,
//                                 payer: zombieWallet.publicKey,
//                                 signers: [zombieWallet],
//                             });
//                         }
//                         else {
//                             bundleItems.push([
//                                 {
//                                     instructions: instructions,
//                                     payer: zombieWallet.publicKey,
//                                     signers: [zombieWallet],
//                                 }
//                             ]);
//                             bundleIndex++;
//                         }
//                     }

//                     index += count;
//                 }

//                 console.log("-----")
//                 let bundleTxns = [];
//                 const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//                 for (let i = 0; i < bundleItems.length; i++) {
//                     const bundleItem = bundleItems[i];
//                     console.log(bundleItem)
//                     let verTxns = [];
//                     for (let j = 0; j < bundleItem.length; j++) {
//                         if (j === bundleItem.length - 1) {
//                             bundleItem[j].instructions = [
//                                 CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
//                                 ...bundleItem[j].instructions,
//                             ];
//                         }
//                         const transactionMessage = new TransactionMessage({
//                             payerKey: bundleItem[j].payer,
//                             instructions: bundleItem[j].instructions,
//                             recentBlockhash,
//                         });
//                         const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
//                         tx.sign(bundleItem[j].signers);
//                         verTxns.push(tx);
//                     }

//                     bundleTxns.push(verTxns);
//                 }

//                 const ret = await buildBundlesOnNB(bundleTxns);
//                 if (!ret) {
//                     logToClients(myClients, "Failed to disperse SOL", false);
//                     for (let k = 0; k < myClients.length; k++)
//                         myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                     return;
//                 }
//             }
//             else {
//                 const zero = new BN(0);
//                 let transactions = [];
//                 let index = 0;
//                 while (index < rAddresses.length) {
//                     let count = rAddresses.length - index;
//                     if (count > 15)
//                         count = 15;

//                     const tx = new Transaction();
//                     for (let i = index; i < index + count; i++) {
//                         const solAmount = new BN(rAmounts[i]);
//                         if (solAmount.gt(zero)) {
//                             tx.add(
//                                 SystemProgram.transfer({
//                                     fromPubkey: zombieWallet.publicKey,
//                                     toPubkey: new PublicKey(rAddresses[i]),
//                                     lamports: rAmounts[i]
//                                 })
//                             );
//                         }
//                     }

//                     if (tx.instructions.length > 0) {
//                         console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
//                         transactions = [
//                             ...transactions,
//                             {
//                                 transaction: tx,
//                                 signers: [zombieWallet],
//                             }
//                         ];
//                     }

//                     index += count;
//                 }

//                 if (transactions.length > 0) {
//                     const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
//                     if (!ret) {
//                         logToClients(myClients, "Failed to disperse SOL", false);
//                         for (let k = 0; k < myClients.length; k++)
//                             myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                         return;
//                     }
//                 }
//             }

//             logToClients(myClients, "Success", false);
//             const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//             for (let k = 0; k < myClients.length; k++) {
//                 if (myClients[k].user.role === "admin")
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//                 else
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
//             }
//         }
//         catch (err) {
//             logToClients(myClients, err, true);
//             for (let k = 0; k < myClients.length; k++)
//                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//         }
//     }
//     catch (err) {
//         console.log(err);
//         res.status(401).json({
//             success: false,
//             error: "Unknown error",
//         });
//     }
// }

exports.disperseSOLs = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Dispersing SOL...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            if (!project.poolInfo || project.poolInfo.baseMint !== project.token.address) {
                let token = project.token.address;
                project.poolInfo = await getPoolInfo(connection, token);
                project.save();
            }

            let addresses = [];
            let amounts = [];
            let buyAddresses = [];
            let buyAmounts = []
            let totalSolAmount = 0n;
            
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    addresses.push(simulateData.wallets[i].address);
                    const solAmountToBuy = new BN(simulateData.wallets[i].sim.buy.solAmount.toString());
                    totalSolAmount += BigInt(solAmountToBuy.toString());
                }
            } 

            // Check if zombie wallet has enough SOL
            let zombieBalance;

            while (true) {
                try {
                    zombieBalance = BigInt(await connection.getBalance(zombieWallet.publicKey));
                    break;
                } catch (err) {

                }
            }

            if (zombieBalance < totalSolAmount) {
                logToClients(myClients, "Failed to disperse SOL: Insufficient Balance", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
            }

            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    addresses.push(simulateData.wallets[i].address);
                    amounts.push(simulateData.wallets[i].sim.disperseAmount);
                }

                if (simulateData.wallets[i].sim.buy.solAmount !== "" && simulateData.wallets[i].sim.buy.solAmount !== "0") {
                    const pubkey = new PublicKey(simulateData.wallets[i].address);
                    const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);

                    let wsolBalance;
                    try {
                        const nativeATAInfo = await getAccount(connection, nativeATA);
                        if (nativeATAInfo) {
                            wsolBalance = new BN(nativeATAInfo.amount.toString());
                        } else {
                            wsolBalance = new BN(0);
                        }
                    } catch (err) {
                        wsolBalance = new BN(0);
                    }

                    const solAmountToBuy = new BN(simulateData.wallets[i].sim.buy.solAmount.toString());
                    let needWSolAmount;
                    if (wsolBalance.gte(solAmountToBuy)) {
                        needWSolAmount = new BN(0);
                    } else {
                        needWSolAmount = solAmountToBuy.sub(wsolBalance);
                    }

                    buyAddresses.push(simulateData.wallets[i].address)
                    buyAmounts.push(needWSolAmount.toString());
                }
            }
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
                    addresses.push(project.teamWallets[i].address);
                    amounts.push(project.teamWallets[i].sim.disperseAmount);
                    // buyAmounts.push(simulateData.teamWallets[i].sim.buy.solAmount);
                }

                try {
                    if (simulateData.teamWallets[i].sim.buy.solAmount !== "" && simulateData.teamWallets[i].sim.buy.solAmount !== "0") {
                        const pubkey = new PublicKey(simulateData.teamWallets[i].address);
                        const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);
                        let wsolBalance;
                        try {
                            const nativeATAInfo = await getAccount(connection, nativeATA);
                            if (nativeATAInfo) {
                                wsolBalance = new BN(nativeATAInfo.amount.toString());
                            } else {
                                wsolBalance = new BN(0);
                            }
                        } catch (err) {
                            wsolBalance = new BN(0);
                        }

                        const solAmountToBuy = new BN(simulateData.teamWallets[i].sim.buy.solAmount.toString());
                        let needWSolAmount;
                        if (wsolBalance.gte(solAmountToBuy)) {
                            needWSolAmount = new BN(0);
                        } else {
                            needWSolAmount = solAmountToBuy.sub(wsolBalance);
                        }

                        buyAddresses.push(simulateData.teamWallets[i].address)
                        buyAmounts.push(needWSolAmount.toString());
                    }
                } catch (err) {
                    console.log("Error in dispersing sol to team wallets ===>", err)
                }
            }

            const jitoTipZombieIx = CreateTraderAPITipInstruction(zombieWallet, LAMPORTS_PER_SOL * jitoTip);
            const tranferIx = SystemProgram.transfer({
                fromPubkey: zombieWallet.publicKey,
                toPubkey: addresses[0],
                lamports: totalSolAmount
            });

            const tx = new Transaction().add(tranferIx).add(jitoTipZombieIx);

            const latestBlockhash = await connection.getLatestBlockhash("confirmed");
            const versionedTx = buildTx(tx, zombieWallet.publicKey, [zombieWallet], latestBlockhash);

            for (let i = 0; i < 3; i++) {
                const result = await rpcConfirmationExecute(
                    versionedTx,
                    latestBlockhash,
                    connection
                );

                if (result) {
                    logToClients(myClients, "Success", false);
                    const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                    for (let k = 0; k < myClients.length; k++) {
                        if (myClients[k].user.role === "admin")
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                        else
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                    }

                    return;
                }
            }

            logToClients(myClients, "Failed to disperse SOL", false);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.disperseSOLsViaMirrors = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Dispersing SOL...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            if (!project.poolInfo || project.poolInfo.baseMint !== project.token.address) {
                let token = project.token.address;
                project.poolInfo = await getPoolInfo(connection, token);
                project.save();
            }

            let buyAddresses = [];

            /// Jito Tip 
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            /// Pre Disperse :::: send sol from zombie to mirror wallets.
            const solInstructionCountPerTransaction = 15;
            const txCountPerBundle = 5;

            const mirrorAddresses = []
            const mirrorAmounts = [];

            let preDisperseIndex = 0;
            let preDisperseTransferItems = [];
            let disperseTransferItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                let preDisperseAmount = "0"
                const index = project.wallets.findIndex(v => v.address == simulateData.wallets[i].address);
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    preDisperseAmount = new BN(preDisperseAmount).add(new BN(simulateData.wallets[i].sim.disperseAmount)).toString();
                }

                if (simulateData.wallets[i].sim.buy.solAmount !== "" && simulateData.wallets[i].sim.buy.solAmount !== "0") {
                    const pubkey = new PublicKey(simulateData.wallets[i].address);
                    const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);

                    let wsolBalance;
                    try {
                        const nativeATAInfo = await getAccount(connection, nativeATA);
                        if (nativeATAInfo) {
                            wsolBalance = new BN(nativeATAInfo.amount.toString());
                        } else {
                            wsolBalance = new BN(0);
                        }
                    } catch (err) {
                        wsolBalance = new BN(0);
                    }

                    const solAmountToBuy = new BN(simulateData.wallets[i].sim.buy.solAmount.toString());
                    let needWSolAmount;
                    if (wsolBalance.gte(solAmountToBuy)) {
                        needWSolAmount = new BN(0);
                    } else {
                        needWSolAmount = solAmountToBuy.sub(wsolBalance);
                    }

                    buyAddresses.push(simulateData.wallets[i].address);

                    preDisperseAmount = new BN(preDisperseAmount).add(needWSolAmount).toString();
                }

                if (preDisperseAmount != "0") {
                    preDisperseTransferItems.push({
                        to: project.mirrorWallets[index].address,
                        amount: preDisperseAmount
                    })
                    disperseTransferItems.push({
                        from: project.mirrorWallets[index].address,
                        to: simulateData.wallets[i].address
                    })
                }
            }

            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
                    preDisperseTransferItems.push({
                        to: project.teamWallets[i].address,
                        amount: project.teamWallets[i].sim.disperseAmount
                    })
                }
            }

            /// Pre Disperse (zombie to mirror wallets)
            // Randomize
            let rPreDisperseTransferItems = [];
            while (preDisperseTransferItems.length > 0) {
                const randomIndex = getRandomNumber(0, preDisperseTransferItems.length - 1);
                rPreDisperseTransferItems.push(preDisperseTransferItems[randomIndex]);
                preDisperseTransferItems.splice(randomIndex, 1);
            }

            if (rPreDisperseTransferItems.length === 0) {

                logToClients(myClients, "Success", false);
                const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                for (let k = 0; k < myClients.length; k++) {
                    if (myClients[k].user.role === "admin")
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                    else
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                }

                return;
            }

            const USE_JITO = true;
            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                console.log("Jito Tip:", jitoTip);

                const zero = new BN(0);
                let bundleIndex = -1;
                let bundleItems = [];
                let index = 0;
                console.log("PreDisperseItems: ", rPreDisperseTransferItems);

                if (!project.isTipPayed && process.env.TIP_ADDRESS && isValidAddress(process.env.TIP_ADDRESS)) {
                    const tipAddress = process.env.TIP_ADDRESS;
                    const tipAmount = project.tipAmount
                    const pos = rPreDisperseTransferItems.length >= 2 ? rPreDisperseTransferItems.length - 2 : rPreDisperseTransferItems.length - 1;
                    rPreDisperseTransferItems.splice(pos, 0, { to: tipAddress, amount: tipAmount });
                }

                while (index < rPreDisperseTransferItems.length) {
                    let count = rPreDisperseTransferItems.length - index;
                    if (count > 15)
                        count = 15;

                    let instructions = [];
                    for (let i = index; i < index + count; i++) {
                        const solAmount = new BN(rPreDisperseTransferItems[i].amount);
                        if (solAmount.gt(zero)) {
                            instructions.push(
                                SystemProgram.transfer({
                                    fromPubkey: zombieWallet.publicKey,
                                    toPubkey: new PublicKey(rPreDisperseTransferItems[i].to),
                                    lamports: rPreDisperseTransferItems[i].amount
                                })
                            );
                        }
                    }

                    if (instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                payer: zombieWallet.publicKey,
                                signers: [zombieWallet],
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    payer: zombieWallet.publicKey,
                                    signers: [zombieWallet],
                                }
                            ]);
                            bundleIndex++;
                        }
                    }

                    index += count;
                }

                console.log("-----")
                let passed = true;
                let bundleTxns = [];
                for (let i = 0; i < bundleItems.length; i++) {
                    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    const bundleItem = bundleItems[i];
                    console.log(bundleItem)
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(zombieWallet.publicKey, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions,
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    const ret = await buildBundleOnNB(verTxns);
                    if (!ret) {
                        passed = false;
                        break;
                    }
                    await sleep(500);
                }

                if (!passed) {
                    logToClients(myClients, "Failed to disperse SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                const zero = new BN(0);
                let transactions = [];
                let index = 0;
                while (index < rPreDisperseTransferItems.length) {
                    let count = rPreDisperseTransferItems.length - index;
                    if (count > 15)
                        count = 15;

                    const tx = new Transaction();
                    for (let i = index; i < index + count; i++) {
                        const solAmount = new BN(rPreDisperseTransferItems[i].amount);
                        if (solAmount.gt(zero)) {
                            tx.add(
                                SystemProgram.transfer({
                                    fromPubkey: zombieWallet.publicKey,
                                    toPubkey: new PublicKey(rPreDisperseTransferItems[i].to),
                                    lamports: rPreDisperseTransferItems[i].amount
                                })
                            );
                        }
                    }

                    if (tx.instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: [zombieWallet],
                            }
                        ];
                    }

                    index += count;
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        logToClients(myClients, "Failed to disperse SOL", false);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }

            logger.debug("Disperse", "Pre Disperse completed, waiting for confirmation...");
            while (true) {
                const balance = new BN((await connection.getBalance(new PublicKey(rPreDisperseTransferItems[rPreDisperseTransferItems.length - 1].to))).toString());
                if (balance.gte(new BN(rPreDisperseTransferItems[rPreDisperseTransferItems.length - 1].amount)))
                    break;
                await sleep(1000);
            }
            await sleep(1000);
            //// Pre Disperse completed

            /// Disperse (mirror to work wallets)
            // Randomize
            let rDisperseTransferItems = [];
            while (disperseTransferItems.length > 0) {
                const randomIndex = getRandomNumber(0, disperseTransferItems.length - 1);
                rDisperseTransferItems.push(disperseTransferItems[randomIndex]);
                disperseTransferItems.splice(randomIndex, 1);
            }

            if (rDisperseTransferItems.length === 0) {

                logToClients(myClients, "Success", false);
                const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                for (let k = 0; k < myClients.length; k++) {
                    if (myClients[k].user.role === "admin")
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                    else
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                }

                return;
            }

            const orgBalance = new BN((await connection.getBalance(new PublicKey(rDisperseTransferItems[rDisperseTransferItems.length - 1].to))).toString());

            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                console.log("Jito Tip:", jitoTip);

                const zero = new BN(0);
                let bundleIndex = -1;
                let bundleItems = [];
                let index = 0;
                console.log("PreDisperseItems: ", rDisperseTransferItems);

                while (index < rDisperseTransferItems.length) {
                    let count = rDisperseTransferItems.length - index;
                    if (count > 6)
                        count = 6;

                    let instructions = [];
                    let signers = [];
                    for (let i = index; i < index + count; i++) {
                        await sleep(50);
                        let balance = 0;
                        while (balance == 0) {
                            try {
                                balance = await connection.getBalance(new PublicKey(rDisperseTransferItems[i].from));
                            } catch (err) {
                                await sleep(4000);
                            }
                        }
                        console.log(balance);
                        let lamports = new BN(balance.toString());
                        if (i == index) {
                            lamports = lamports.sub(new BN(1005000));

                            if (bundleIndex == -1 || bundleItems[bundleIndex] == null || bundleItems[bundleIndex].length == BUNDLE_TX_LIMIT) {
                                console.log("remove", i);
                                lamports = lamports.sub(new BN(jitoTip * LAMPORTS_PER_SOL))
                            }
                        }
                        console.log("lamports", lamports.toString());

                        const solAmount = lamports;
                        if (solAmount.gt(zero)) {
                            instructions.push(
                                SystemProgram.transfer({
                                    fromPubkey: new PublicKey(rDisperseTransferItems[i].from),
                                    toPubkey: new PublicKey(rDisperseTransferItems[i].to),
                                    lamports: lamports.toString()
                                })
                            );
                            const keyItem = await Wallet.findOne({ address: rDisperseTransferItems[i].from });
                            signers.push(Keypair.fromSecretKey(base58.decode(keyItem.privateKey)));
                        }
                    }

                    if (instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                payer: signers[0].publicKey,
                                signers: signers,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    payer: signers[0].publicKey,
                                    signers: signers,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }

                    index += count;
                }

                console.log("-----")
                let passed = true;
                let bundleTxns = [];
                for (let i = 0; i < bundleItems.length; i++) {
                    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    const bundleItem = bundleItems[i];
                    console.log(bundleItem)
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === 0) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].signers[0].publicKey, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions,
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    const ret = await buildBundleOnNB(verTxns);
                    if (!ret) {
                        passed = false;
                        break;
                    }
                    await sleep(500);
                }

                if (!passed) {
                    logToClients(myClients, "Failed to disperse SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                const zero = new BN(0);
                let transactions = [];
                let index = 0;
                while (index < rDisperseTransferItems.length) {
                    let count = rDisperseTransferItems.length - index;
                    if (count > 10)
                        count = 10;

                    let signers = []
                    const tx = new Transaction();
                    for (let i = index; i < index + count; i++) {
                        const balance = await connection.getBalance(new PublicKey(rDisperseTransferItems[i].from));
                        let lamports = new BN(balance.toString());
                        if (i == 0) {
                            lamports = lamports.sub(new BN(5000));
                        }
                        const solAmount = lamports;
                        if (solAmount.gt(zero)) {
                            tx.add(
                                SystemProgram.transfer({
                                    fromPubkey: new PublicKey(rDisperseTransferItems[i].from),
                                    toPubkey: new PublicKey(rDisperseTransferItems[i].to),
                                    lamports: lamports.toString()
                                })
                            );

                            const keyItem = await Wallet.findOne({ address: rDisperseTransferItems[i].from });
                            signers.push(Keypair.fromSecret(base58.decode(keyItem.privateKey)));
                        }
                    }

                    if (tx.instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: signers,
                            }
                        ];
                    }

                    index += count;
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        logToClients(myClients, "Failed to disperse SOL", false);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }
            logger.debug("Disperse", "Disperse completed, waiting for confirmation ...");
            while (true) {
                const curBalance = new BN((await connection.getBalance(new PublicKey(rDisperseTransferItems[rDisperseTransferItems.length - 1].to))).toString());
                if (curBalance.gt(orgBalance))
                    break;
                await sleep(1000);
            }
            await sleep(1000);
            //// Disperse completed

            /// Creating Lookup Table ...
            let lookupTableAccounts;
            lookupTableAccounts = await registerAddressLookup(
                connection,
                project.poolInfo,
                buyAddresses,
                zombieWallet,
                project.lookupTableAddress
            );
            if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                logToClients(myClients, "Failed to register Address Lookup.", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return false;
            }
            lookupTableAccountsForProject[project._id] = lookupTableAccounts;
            logger.debug("disperse_sol", `lookup table creation finished. LUT:${project.lookupTableAddress}`);

            //// Creating WSOL Account and token account
            let instructions = [];
            signers = [];
            let transactionItems = [];
            const mint = new PublicKey(project.token.address);
            let bundleIndex = -1;
            let bundleItems = [];
            const MAX_WALLET_PER_TX = 5;
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.solAmount !== "" && simulateData.wallets[i].sim.buy.solAmount !== "0") {
                    const pubkey = new PublicKey(simulateData.wallets[i].address);
                    const nativeATA = getAssociatedTokenAddressSync(NATIVE_MINT, pubkey);
                    const tokenATA = getAssociatedTokenAddressSync(mint, pubkey);

                    await sleep(20);
                    if (!(await connection.getAccountInfo(tokenATA))) {
                        instructions.push(
                            createAssociatedTokenAccountInstruction(
                                pubkey,
                                tokenATA,
                                pubkey,
                                mint
                            )
                        );
                    }

                    await sleep(20);
                    if (!(await connection.getAccountInfo(nativeATA))) {
                        instructions.push(
                            createAssociatedTokenAccountInstruction(
                                pubkey,
                                nativeATA,
                                pubkey,
                                NATIVE_MINT
                            )
                        );
                    }

                    let wsolBalance;
                    try {
                        await sleep(20);
                        const nativeATAInfo = await getAccount(connection, nativeATA);
                        if (nativeATAInfo) {
                            wsolBalance = new BN(nativeATAInfo.amount.toString());
                        } else {
                            wsolBalance = new BN(0);
                        }
                    } catch (err) {
                        wsolBalance = new BN(0);
                    }

                    const solAmountToBuy = new BN(simulateData.wallets[i].sim.buy.solAmount.toString());
                    let needWSolAmount;
                    if (wsolBalance.gte(solAmountToBuy)) {
                        needWSolAmount = new BN(0);
                    } else {
                        needWSolAmount = solAmountToBuy.sub(wsolBalance);
                    }

                    if (needWSolAmount.gtn(0)) {
                        instructions.push(
                            SystemProgram.transfer({
                                fromPubkey: pubkey,
                                toPubkey: nativeATA,
                                lamports: needWSolAmount.toString(),
                            })
                        );
                        instructions.push(createSyncNativeInstruction(nativeATA));
                        const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                        signers.push(Keypair.fromSecretKey(base58.decode(walletItem.privateKey)));

                        if (signers.length >= MAX_WALLET_PER_TX) {
                            transactionItems.push({
                                instructions: [...instructions],
                                payer: signers[0].publicKey,
                                signers: [...signers],
                            });
                            instructions = [];
                            signers = [];
                        }
                    }
                }
            }

            if (signers.length > 0) {
                transactionItems.push({
                    instructions: [...instructions],
                    payer: signers[0].publicKey,
                    signers: [...signers],
                });
                instructions = [];
                signers = [];
            }

            for (let i = 0; i < transactionItems.length; i++) {
                if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                    bundleItems[bundleIndex].push(transactionItems[i]);
                }
                else {
                    bundleItems.push([transactionItems[i]]);
                    bundleIndex++;
                }
            }

            console.log("-----")
            let passed = true;
            let bundleTxns = [];
            for (let i = 0; i < bundleItems.length; i++) {
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                const bundleItem = bundleItems[i];
                console.log(bundleItem)
                let verTxns = [];
                for (let j = 0; j < bundleItem.length; j++) {
                    if (j === bundleItem.length - 1) {
                        bundleItem[j].instructions = [
                            CreateTraderAPITipInstruction(bundleItem[j].payer, jitoTip * LAMPORTS_PER_SOL),
                            ...bundleItem[j].instructions,
                        ];
                    }
                    const transactionMessage = new TransactionMessage({
                        payerKey: bundleItem[j].payer,
                        instructions: bundleItem[j].instructions,
                        recentBlockhash,
                    });
                    const tx = new VersionedTransaction(transactionMessage.compileToV0Message(lookupTableAccounts ? lookupTableAccounts : []));
                    tx.sign(bundleItem[j].signers);
                    verTxns.push(tx);
                }

                const ret = await buildBundleOnNB(verTxns);
                if (!ret) {
                    passed = false;
                    break;
                }
                await sleep(500);
            }

            if (!passed) {
                logToClients(myClients, "Failed to disperse SOL", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }
            logger.debug("disperse_sol", "Disperse completed");

            logToClients(myClients, "Success", false);
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

// exports.pumpfunDisperseSOLs = async (req, res) => {
//     const { simulateData } = req.body;
//     console.log("Dispersing SOL...", simulateData);
//     try {
//         const project = await Project.findById(simulateData.projectId);
//         if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
//             console.log("Mismatched user id or Not activated project!");
//             res.status(401).json({
//                 success: false,
//                 error: "User ID mismatch Or Not activated project",
//             });
//             return;
//         }

//         res.status(200).json({
//             success: true
//         });

//         const clients = getWebSocketClientList();
//         const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
//         try {
//             const zombieWallet = await getZombieWallet(project);
//             if (!zombieWallet) {
//                 logToClients(myClients, "ERROR: Zombie wallet not set", false);
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return;
//             }

//             const { connection } = useConnection();
//             let addresses = [];
//             let amounts = [];
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
//                     addresses.push(simulateData.wallets[i].address);
//                     amounts.push(simulateData.wallets[i].sim.disperseAmount);
//                 }
//             }
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
//                     addresses.push(project.teamWallets[i].address);
//                     amounts.push(project.teamWallets[i].sim.disperseAmount);
//                 }
//             }

//             if (project.token.authority) {
//                 let balanceOfAuthority = await connection.getBalance(new PublicKey(project.token.authority));
//                 balanceOfAuthority = new BN(balanceOfAuthority.toString());
//                 let needBalanceOfAuthority = new BN(0.05 * LAMPORTS_PER_SOL);
//                 if (needBalanceOfAuthority.gt(balanceOfAuthority)) {
//                     needBalanceOfAuthority = needBalanceOfAuthority.sub(balanceOfAuthority);
//                 }
//                 addresses.push(project.token.authority);
//                 amounts.push(needBalanceOfAuthority.toString())
//             }

//             for (let i = 0; i < addresses.length; i++) {
//                 console.log("address:", addresses[i], " amount:", amounts[i]);
//             }  
//             // Randomize
//             let rAddresses = [];
//             let rAmounts = [];
//             while (addresses.length > 0) {
//                 const randomIndex = getRandomNumber(0, addresses.length - 1);
//                 rAddresses.push(addresses[randomIndex]);
//                 rAmounts.push(amounts[randomIndex]);
//                 addresses.splice(randomIndex, 1);
//                 amounts.splice(randomIndex, 1);
//             }

//             if (rAddresses.length === 0) {

//                 logToClients(myClients, "Success", false);
//                 const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//                 for (let k = 0; k < myClients.length; k++) {
//                     if (myClients[k].user.role === "admin")
//                         myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//                     else
//                         myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
//                 }

//                 return;
//             }

//             // const USE_JITO = true;
//             // if (USE_JITO) {
//             //     const jitoTip = 0.0006;
//             //     console.log("Jito Tip:", jitoTip);

//             //     const zero = new BN(0);
//             //     let bundleIndex = -1;
//             //     let bundleItems = [];
//             //     let index = 0;
//             //     console.log("rAddresses: ", rAddresses)


//             //     if (rAddresses.length === 0) {
//             //         logToClients(myClients, "Success", false);
//             //         const projectForUsers = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//             //         for (let k = 0; k < myClients.length; k++) {
//             //             if (myClients[k].user.role === "admin")
//             //                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//             //             else
//             //                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUsers }));
//             //         }
//             //     }

//             //     if (!project.isTipPayed && process.env.TIP_ADDRESS && isValidAddress(process.env.TIP_ADDRESS)) {
//             //         const tipAddress = process.env.TIP_ADDRESS;
//             //         const tipAmount = project.tipAmount
//             //         const pos = rAddresses.length >= 2 ? rAddresses.length - 2 : rAddresses.length - 1;
//             //         rAddresses.splice(pos, 0, tipAddress);
//             //         rAmounts.splice(pos, 0, tipAmount);
//             //     }

//             //     while (index < rAddresses.length) {
//             //         let count = rAddresses.length - index;
//             //         if (count > 15)
//             //             count = 15;

//             //         let instructions = [];
//             //         for (let i = index; i < index + count; i++) {
//             //             const solAmount = new BN(rAmounts[i]);
//             //             if (solAmount.gt(zero)) {
//             //                 instructions.push(
//             //                     SystemProgram.transfer({
//             //                         fromPubkey: zombieWallet.publicKey,
//             //                         toPubkey: new PublicKey(rAddresses[i]),
//             //                         lamports: rAmounts[i]
//             //                     })
//             //                 );
//             //             }
//             //         }

//             //         if (instructions.length > 0) {
//             //             console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
//             //             if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < 4) {
//             //                 bundleItems[bundleIndex].push({
//             //                     instructions: instructions,
//             //                     payer: zombieWallet.publicKey,
//             //                     signers: [zombieWallet],
//             //                 });
//             //             }
//             //             else {
//             //                 bundleItems.push([
//             //                     {
//             //                         instructions: instructions,
//             //                         payer: zombieWallet.publicKey,
//             //                         signers: [zombieWallet],
//             //                     }
//             //                 ]);
//             //                 bundleIndex++;
//             //             }
//             //         }

//             //         index += count;
//             //     }

//             //     console.log("-----")
//             //     let bundleTxns = [];
//             //     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//             //     for (let i = 0; i < bundleItems.length; i++) {
//             //         const bundleItem = bundleItems[i];
//             //         console.log(bundleItem)
//             //         let verTxns = [];
//             //         for (let j = 0; j < bundleItem.length; j++) {
//             //             if (j === bundleItem.length - 1) {
//             //                 bundleItem[j].instructions = [
//             //                     CreateTraderAPITipInstruction(bundleItem[j].payer, jitoTip * LAMPORTS_PER_SOL),
//             //                     ...bundleItem[j].instructions,
//             //                 ];
//             //             }
//             //             const transactionMessage = new TransactionMessage({
//             //                 payerKey: bundleItem[j].payer,
//             //                 instructions: bundleItem[j].instructions,
//             //                 recentBlockhash,
//             //             });
//             //             const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
//             //             tx.sign(bundleItem[j].signers);
//             //             verTxns.push(tx);
//             //         }

//             //         bundleTxns.push(verTxns);
//             //     }

//             //     const ret = await buildBundlesOnNB(bundleTxns)
//             //     if (!ret) {
//             //         logToClients(myClients, "Failed to disperse SOL", false);
//             //         for (let k = 0; k < myClients.length; k++)
//             //             myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//             //         return;
//             //     }
//             //     project.isTipPayed = true;
//             //     project.save();
//             // }
//             // else {
//             //     const zero = new BN(0);
//             //     let transactions = [];
//             //     let index = 0;
//             //     while (index < rAddresses.length) {
//             //         let count = rAddresses.length - index;
//             //         if (count > 15)
//             //             count = 15;

//             //         const tx = new Transaction();
//             //         for (let i = index; i < index + count; i++) {
//             //             const solAmount = new BN(rAmounts[i]);
//             //             if (solAmount.gt(zero)) {
//             //                 tx.add(
//             //                     SystemProgram.transfer({
//             //                         fromPubkey: zombieWallet.publicKey,
//             //                         toPubkey: new PublicKey(rAddresses[i]),
//             //                         lamports: rAmounts[i]
//             //                     })
//             //                 );
//             //             }
//             //         }

//             //         if (tx.instructions.length > 0) {
//             //             console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
//             //             transactions = [
//             //                 ...transactions,
//             //                 {
//             //                     transaction: tx,
//             //                     signers: [zombieWallet],
//             //                 }
//             //             ];
//             //         }

//             //         index += count;
//             //     }

//             //     if (transactions.length > 0) {
//             //         const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
//             //         if (!ret) {
//             //             logToClients(myClients, "Failed to disperse SOL", false);
//             //             for (let k = 0; k < myClients.length; k++)
//             //                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//             //             return;
//             //         }
//             //     }
//             // }

//             logToClients(myClients, "Success", false);
//             const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//             for (let k = 0; k < myClients.length; k++) {
//                 if (myClients[k].user.role === "admin")
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//                 else
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
//             }
//         }
//         catch (err) {
//             logToClients(myClients, err, true);
//             for (let k = 0; k < myClients.length; k++)
//                 myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//         }
//     }
//     catch (err) {
//         console.log(err);
//         res.status(401).json({
//             success: false,
//             error: "Unknown error",
//         });
//     }
// }

exports.pumpfunDisperseSOLs = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Dispersing SOL...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            const { connection } = useConnection();
            let addresses = [];
            let amounts = [];
            let tokenAmounts = [];
            let totalSolAmount = BigInt(0);

            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    addresses.push(simulateData.wallets[i].address);
                    amounts.push(simulateData.wallets[i].sim.disperseAmount);
                    tokenAmounts.push(simulateData.wallets[i].sim.buy.tokenAmount);
                    totalSolAmount += BigInt(Math.round(Number(simulateData.wallets[i].sim.disperseAmount))); 
                }
            }

            // for (let i = 0; i < project.teamWallets.length; i++) {
            //     if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
            //         addresses.push(project.teamWallets[i].address);
            //         amounts.push(project.teamWallets[i].sim.disperseAmount);
            //     }
            // }

            // if (project.token.authority) {
            //     let balanceOfAuthority = await connection.getBalance(new PublicKey(project.token.authority));
            //     balanceOfAuthority = new BN(balanceOfAuthority.toString());
            //     let needBalanceOfAuthority = new BN(0.05 * LAMPORTS_PER_SOL);
            //     if (needBalanceOfAuthority.gt(balanceOfAuthority)) {
            //         needBalanceOfAuthority = needBalanceOfAuthority.sub(balanceOfAuthority);
            //     }
            //     addresses.push(project.token.authority);
            //     amounts.push(needBalanceOfAuthority.toString())
            // }

            for (let i = 0; i < addresses.length; i++) {
                console.log("address:", addresses[i], " amount:", amounts[i], "tokenAmount", tokenAmounts[i]);
            }
            
            // Check if zombie wallet has enough SOL
            let zombieBalance = BigInt(0);
            while (true) {
                try {
                    zombieBalance = BigInt(await connection.getBalance(zombieWallet.publicKey));
                    break;
                } catch (err) {

                }
            }

            console.log("totalSolAmount", totalSolAmount.toString(), "zombieBalance", zombieBalance.toString());

            // if (zombieBalance < totalSolAmount) {
            //     logToClients(myClients, "Failed to disperse SOL: Insufficient Balance", false);
            //         for (let k = 0; k < myClients.length; k++)
            //             myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
            //         return;
            // }

            logToClients(myClients, "Success", false);
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.pumpfunDisperseSOLsViaMirrors = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Dispersing SOL...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            const { connection } = useConnection();
            let preDisperseTransferItems = [];
            let disperseTransferItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                const index = project.wallets.findIndex(item => item.address === simulateData.wallets[i].address);
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    preDisperseTransferItems.push({
                        to: project.mirrorWallets[index].address,
                        amount: simulateData.wallets[i].sim.disperseAmount
                    });
                    disperseTransferItems.push({
                        from: project.mirrorWallets[index].address,
                        to: simulateData.wallets[i].address
                    });
                }
            }
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.disperseAmount !== "" && project.teamWallets[i].sim.disperseAmount !== "0") {
                    preDisperseTransferItems.push({
                        to: project.teamWallets[i].address,
                        amount: project.teamWallets[i].sim.disperseAmount
                    });
                }
            }

            if (project.token.authority) {
                let balanceOfAuthority = await connection.getBalance(new PublicKey(project.token.authority));
                balanceOfAuthority = new BN(balanceOfAuthority.toString());
                let needBalanceOfAuthority = new BN(0.05 * LAMPORTS_PER_SOL);
                if (needBalanceOfAuthority.gt(balanceOfAuthority)) {
                    needBalanceOfAuthority = needBalanceOfAuthority.sub(balanceOfAuthority);
                    preDisperseTransferItems.push({
                        to: project.token.authority,
                        amount: needBalanceOfAuthority.toString()
                    });
                }
            }

            /// Pre Disperse (zombie to mirror wallets)
            // Randomize
            let rPreDisperseTransferItems = [];
            while (preDisperseTransferItems.length > 0) {
                const randomIndex = getRandomNumber(0, preDisperseTransferItems.length - 1);
                rPreDisperseTransferItems.push(preDisperseTransferItems[randomIndex]);
                preDisperseTransferItems.splice(randomIndex, 1);
            }

            if (rPreDisperseTransferItems.length === 0) {

                logToClients(myClients, "Failed to disperse SOL", false);
                const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                for (let k = 0; k < myClients.length; k++) {
                    if (myClients[k].user.role === "admin")
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                    else
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                }

                return;
            }

            const USE_JITO = true;
            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                console.log("Jito Tip:", jitoTip);

                const zero = new BN(0);
                let bundleIndex = -1;
                let bundleItems = [];
                let index = 0;
                console.log("PreDisperseItems: ", rPreDisperseTransferItems);

                if (!project.isTipPayed && process.env.TIP_ADDRESS && isValidAddress(process.env.TIP_ADDRESS)) {
                    const tipAddress = process.env.TIP_ADDRESS;
                    const tipAmount = project.tipAmount
                    const pos = rPreDisperseTransferItems.length >= 2 ? rPreDisperseTransferItems.length - 2 : rPreDisperseTransferItems.length - 1;
                    rPreDisperseTransferItems.splice(pos, 0, { to: tipAddress, amount: tipAmount });
                }

                while (index < rPreDisperseTransferItems.length) {
                    let count = rPreDisperseTransferItems.length - index;
                    if (count > 15)
                        count = 15;

                    let instructions = [];
                    for (let i = index; i < index + count; i++) {
                        const solAmount = new BN(rPreDisperseTransferItems[i].amount);
                        if (solAmount.gt(zero)) {
                            instructions.push(
                                SystemProgram.transfer({
                                    fromPubkey: zombieWallet.publicKey,
                                    toPubkey: new PublicKey(rPreDisperseTransferItems[i].to),
                                    lamports: rPreDisperseTransferItems[i].amount
                                })
                            );
                        }
                    }

                    if (instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                payer: zombieWallet.publicKey,
                                signers: [zombieWallet],
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    payer: zombieWallet.publicKey,
                                    signers: [zombieWallet],
                                }
                            ]);
                            bundleIndex++;
                        }
                    }

                    index += count;
                }

                console.log("-----")
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    const bundleItem = bundleItems[i];
                    console.log(bundleItem)
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(zombieWallet.publicKey, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions,
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    logToClients(myClients, "Failed to disperse SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                const zero = new BN(0);
                let transactions = [];
                let index = 0;
                while (index < rPreDisperseTransferItems.length) {
                    let count = rPreDisperseTransferItems.length - index;
                    if (count > 15)
                        count = 15;

                    const tx = new Transaction();
                    for (let i = index; i < index + count; i++) {
                        const solAmount = new BN(rPreDisperseTransferItems[i].amount);
                        if (solAmount.gt(zero)) {
                            tx.add(
                                SystemProgram.transfer({
                                    fromPubkey: zombieWallet.publicKey,
                                    toPubkey: new PublicKey(rPreDisperseTransferItems[i].to),
                                    lamports: rPreDisperseTransferItems[i].amount
                                })
                            );
                        }
                    }

                    if (tx.instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: [zombieWallet],
                            }
                        ];
                    }

                    index += count;
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        logToClients(myClients, "Failed to disperse SOL", false);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }
            project.isTipPayed = true;
            project.save();
            logger.debug("PumpfunDisperse", "Pre Disperse completed, waiting for confirmation...");
            while (true) {
                const balance = new BN((await connection.getBalance(new PublicKey(rPreDisperseTransferItems[rPreDisperseTransferItems.length - 1].to))).toString());
                if (balance.gte(new BN(rPreDisperseTransferItems[rPreDisperseTransferItems.length - 1].amount)))
                    break;
                await sleep(1000);
            }
            await sleep(1000);
            //// Pre Disperse completed

            /// Pre Disperse (zombie to mirror wallets)
            // Randomize
            let rDisperseTransferItems = [];
            while (disperseTransferItems.length > 0) {
                const randomIndex = getRandomNumber(0, disperseTransferItems.length - 1);
                rDisperseTransferItems.push(disperseTransferItems[randomIndex]);
                disperseTransferItems.splice(randomIndex, 1);
            }

            if (rDisperseTransferItems.length === 0) {

                logToClients(myClients, "Success", false);
                const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                for (let k = 0; k < myClients.length; k++) {
                    if (myClients[k].user.role === "admin")
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                    else
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                }

                return;
            }

            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                console.log("Jito Tip:", jitoTip);

                const zero = new BN(0);
                let bundleIndex = -1;
                let bundleItems = [];
                let index = 0;
                console.log("PreDisperseItems: ", rDisperseTransferItems);

                while (index < rDisperseTransferItems.length) {
                    let count = rDisperseTransferItems.length - index;
                    if (count > 6)
                        count = 6;

                    let instructions = [];
                    let signers = [];
                    for (let i = index; i < index + count; i++) {
                        await sleep(50);
                        let balance = 0;
                        while (balance == 0) {
                            try {
                                balance = await connection.getBalance(new PublicKey(rDisperseTransferItems[i].from));
                            } catch (err) {
                                await sleep(4000);
                            }
                        }
                        console.log(balance);
                        let lamports = new BN(balance.toString());
                        if (i == index) {
                            lamports = lamports.sub(new BN(1005000));

                            if (bundleIndex == -1 || bundleItems[bundleIndex] == null || bundleItems[bundleIndex].length == BUNDLE_TX_LIMIT) {
                                console.log("remove", i);
                                lamports = lamports.sub(new BN(jitoTip * LAMPORTS_PER_SOL))
                            }
                        }
                        console.log("lamports", lamports.toString());

                        const solAmount = lamports;
                        if (solAmount.gt(zero)) {
                            instructions.push(
                                SystemProgram.transfer({
                                    fromPubkey: new PublicKey(rDisperseTransferItems[i].from),
                                    toPubkey: new PublicKey(rDisperseTransferItems[i].to),
                                    lamports: lamports.toString()
                                })
                            );
                            const keyItem = await Wallet.findOne({ address: rDisperseTransferItems[i].from });
                            signers.push(Keypair.fromSecretKey(base58.decode(keyItem.privateKey)));
                        }
                    }

                    if (instructions.length > 0) {
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, instructions.length);
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                payer: signers[0].publicKey,
                                signers: signers,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    payer: signers[0].publicKey,
                                    signers: signers,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }

                    index += count;
                }

                console.log("-----")
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    const bundleItem = bundleItems[i];
                    console.log(bundleItem)
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === 0) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].signers[0].publicKey, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions,
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    logToClients(myClients, "Failed to disperse SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                const zero = new BN(0);
                let transactions = [];
                let index = 0;
                while (index < rDisperseTransferItems.length) {
                    let count = rDisperseTransferItems.length - index;
                    if (count > 6)
                        count = 6;

                    let signers = []
                    const tx = new Transaction();
                    for (let i = index; i < index + count; i++) {
                        const balance = await connection.getBalance(new PublicKey(rDisperseTransferItems[i].from));
                        let lamports = new BN(balance.toString());
                        if (i == 0) {
                            lamports = lamports.sub(new BN(1005000));
                        }
                        const solAmount = lamports;
                        if (solAmount.gt(zero)) {
                            tx.add(
                                SystemProgram.transfer({
                                    fromPubkey: new PublicKey(rDisperseTransferItems[i].from),
                                    toPubkey: new PublicKey(rDisperseTransferItems[i].to),
                                    lamports: lamports.toString()
                                })
                            );

                            const keyItem = await Wallet.findOne({ address: rDisperseTransferItems[i].from });
                            signers.push(Keypair.fromSecretKey(base58.decode(keyItem.privateKey)));
                        }
                    }

                    if (tx.instructions.length > 0) {
                        tx.feePayer = signers[0].publicKey;
                        console.log(`Transfer Instructions(${index}-${index + count - 1}):`, tx.instructions.length);
                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: signers,
                            }
                        ];
                    }

                    index += count;
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        logToClients(myClients, "Failed to disperse SOL", false);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }
            logger.debug("PumpfunDisperse", "✅ Disperse completed ");
            //// Disperse completed

            logToClients(myClients, "Success", false);
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.sendOrReceive = async (req, res) => {
    const { projectId, token, wallets, teamWallets, useJito = true } = req.body;
    console.log("Transferring tokens...", projectId, token, wallets, teamWallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            const zombieKeypair = await getZombieWallet(project);
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const mint = new PublicKey(token.address ? token.address : token);
            // const mintInfo = await getMint(connection, mint);

            const USE_JITO = true;
            const tWallets = [
                ...teamWallets,
                ...wallets,
            ];
            if (USE_JITO) {
                let bundleItems = [];
                let bundleIndex = -1;
                let index = 0;
                while (index < tWallets.length) {
                    let payer = null;
                    let signers = [];

                    let count = 0;
                    let instructions = [];
                    for (let i = index; i < tWallets.length; i++) {
                        const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                        if (!walletItem) continue;
                        const fromAccount = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                        if (mint.toBase58() != "So11111111111111111111111111111111111111112") {
                            const programId = new PublicKey(token.programId);
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, fromAccount.publicKey, false, programId);
                            const fromAccountInfo = await getAccount(connection, fromTokenAccount, "processed", programId);
                            if (!fromTokenAccount)
                                continue;

                            if (count === 0) {
                                payer = fromAccount.publicKey;

                                const balanceSol = new BN(await connection.getBalance(payer));
                                if (balanceSol.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                                    console.log("Insufficient SOL!", payer.toBase58());
                                    for (let k = 0; k < myClients.length; k++)
                                        myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                                    return;
                                }
                            }

                            const toPublicKey = new PublicKey(tWallets[i].receipent);
                            const toTokenAccount = getAssociatedTokenAddressSync(mint, toPublicKey, false, programId);
                            let tokenAmount = new BN(new BigNumber(tWallets[i].amount + "e" + token.decimals.toString()).toFixed(0));
                            const walletTokenAmount = new BN(fromAccountInfo.amount.toString());
                            if (tokenAmount.gt(walletTokenAmount)) {
                                tokenAmount = walletTokenAmount;
                            }
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    instructions.push(
                                        createAssociatedTokenAccountInstruction(
                                            fromAccount.publicKey,
                                            toTokenAccount,
                                            toPublicKey,
                                            mint,
                                            programId
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            instructions.push(
                                programId.equals(TOKEN_PROGRAM_ID) ?
                                    createTransferInstruction(
                                        fromTokenAccount,
                                        toTokenAccount,
                                        fromAccount.publicKey,
                                        tokenAmount.toString(),
                                        [],
                                        programId
                                    ) :
                                    createTransferCheckedInstruction(
                                        fromTokenAccount,
                                        mint,
                                        toTokenAccount,
                                        fromAccount.publicKey,
                                        tokenAmount.toString(),
                                        token.decimals,
                                        [],
                                        programId
                                    )
                            );
                        } else {
                            let solAmount = new BN(new BigNumber(tWallets[i].amount + "e9").toFixed(0));
                            const balance = await connection.getBalance(fromAccount.publicKey);
                            const required = 0.001 * LAMPORTS_PER_SOL;
                            if (Number(balance) <= required) continue;
                            if (balance == 0) continue;
                            // const walletSolAmount = new BN(Math.floor(balance));
                            const walletSolAmount = new BN((BigInt(balance) - BigInt(required)).toString());
                            console.log(solAmount.toString(), walletSolAmount.toString())
                            if (solAmount.gt(walletSolAmount)) {
                                solAmount = walletSolAmount;
                            }
                            console.log(solAmount.toString())
                            if (new BN(solAmount).gt(new BN(0))) {
                                instructions.push(
                                    SystemProgram.transfer({
                                        fromPubkey: fromAccount.publicKey,
                                        toPubkey: new PublicKey(tWallets[i].receipent),
                                        lamports: solAmount.toString()
                                    })
                                );
                            }

                            if (count == 0)
                                payer = fromAccount.publicKey;
                        }

                        signers = [
                            ...signers,
                            fromAccount,
                        ];

                        count++;
                        if (mint.toBase58() == "So11111111111111111111111111111111111111112") {
                            if (count === 8)
                                break;
                        } else {
                            if (count === 4)
                                break;
                        }
                    }

                    console.log(payer, signers)

                    if (instructions.length > 0) {
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                signers: signers,
                                payer: payer,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    signers: signers,
                                    payer: payer,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }
                    else
                        break;

                    index += count;
                }

                console.log("Bundle Items:", bundleItems.length);
                let count = 0;
                for (let i = 0; i < bundleItems.length; i++) {
                    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
                    const recentBlockhash = latestBlockhash.blockhash;
                    const bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions.push(
                                CreateTraderAPITipInstruction(zombieKeypair.publicKey, LAMPORTS_PER_SOL * jitoTip)
                                // CreateJitoTipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip)
                            );
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: zombieKeypair.publicKey,
                            // payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign([...bundleItem[j].signers, zombieKeypair]);
                        verTxns.push(tx);

                        // if (j == 0) {
                        //     try {
                        //         const signature = await connection.sendRawTransaction(
                        //             tx.serialize(),
                        //             {
                        //                 preflightCommitment: "confirmed",
                        //                 skipPreflight: false,
                        //                 maxRetries: 0,
                        //             }
                        //         );
                        //         console.log(signature);
                        //     } catch (error) {
                        //         console.log(error);
                        //     }
                        // }
                    }

                    const ret = await buildBundleOnNBAndConfirmTxId(connection, verTxns, "confirmed");
                    if (ret) count++;
                    await sleep(3000);
                }

                if (count < bundleItems.length) {
                    console.log("Failed to transfer tokens");
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                let transactions = [];
                for (let i = 0; i < tWallets.length; i++) {
                    const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                    const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                    if (mint.toBase58() != "So11111111111111111111111111111111111111112") {
                        const fromTokenAccount = getAssociatedTokenAddressSync(mint, account.publicKey);
                        if (!fromTokenAccount)
                            continue;

                        const to = new PublicKey(tWallets[i].receipent);
                        const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, account, mint, to);
                        const tokenAmount = new BigNumber(tWallets[i].amount + "e" + token.decimals.toString()).toFixed(0);
                        const tx = new Transaction().add(
                            createTransferInstruction(
                                fromTokenAccount,
                                toTokenAccount.address,
                                account.publicKey,
                                tokenAmount)
                        );

                        transactions = [
                            ...transactions,
                            {
                                transaction: tx,
                                signers: [account],
                            }
                        ];
                    } else {
                        const solAmount = new BigNumber(tWallets[i].amount + "e9").toFixed(0);
                        if (new BN(solAmount).gt(new BN(0))) {
                            const tx = new Transaction().add(
                                SystemProgram.transfer({
                                    fromPubkey: account.publicKey,
                                    toPubkey: new PublicKey(tWallets[i].receipent),
                                    lamports: solAmount
                                })
                            );

                            transactions = [
                                ...transactions,
                                {
                                    transaction: tx,
                                    signers: [account],
                                }
                            ];
                        }
                    }

                    const taxTx = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: account.publicKey,
                            toPubkey: new PublicKey(getTaxWallet()),
                            lamports: LAMPORTS_PER_SOL * parseFloat(process.env.TRANSFER_TAX)
                        })
                    );

                    transactions = [
                        ...transactions,
                        {
                            transaction: taxTx,
                            signers: [account],
                        }
                    ];
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to transfer tokens...");
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }

            console.log("Success");

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.transferAll = async (req, res) => {
    const { projectId } = req.body;
    console.log("Transferring token and sol...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const token = project.token.address;
            const mint = new PublicKey(project.token.address);
            const mintInfo = await getMint(connection, mint);

            const zombieWalletItem = await Wallet.findOne({ address: project.zombie });
            if (!zombieWalletItem) return;
            const zombieWalletAccount = Keypair.fromSecretKey(bs58.decode(zombieWalletItem.privateKey));

            const USE_JITO = true;
            const tWallets = [...project.wallets];
            if (USE_JITO) {
                let bundleItems = [];
                let bundleIndex = -1;
                let index = 0;
                while (index < tWallets.length) {
                    let payer = null;
                    let signers = [];

                    let count = 0;
                    let instructions = [];
                    for (; index < tWallets.length; index++) {
                        let i = index;
                        const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                        if (!walletItem) continue;
                        const fromAccount = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                        const fromTokenAccount = getAssociatedTokenAddressSync(mint, fromAccount.publicKey);
                        let tokenAmount = 0;
                        try {
                            const fromAccountInfo = await getAccount(connection, fromTokenAccount);
                            tokenAmount = fromAccountInfo.amount;
                        } catch (err) {
                            continue;
                        }

                        if (Number(tokenAmount) == 0) {
                            continue;
                        }

                        const keypair = Keypair.generate();
                        const newWalletItem = await Wallet.create({
                            address: keypair.publicKey.toBase58(),
                            privateKey: bs58.encode(keypair.secretKey),
                            category: "temporary",
                            userId: project.userId,
                        });

                        project.wallets = [
                            ...project.wallets,
                            {
                                address: newWalletItem.address,
                                initialTokenAmount: "",
                                sim: {
                                    disperseAmount: "",
                                    buy: {
                                        tokenAmount: "",
                                        solAmount: ""
                                    },
                                    xfer: {
                                        fromAddress: "",
                                        tokenAmount: ""
                                    }
                                },
                            }
                        ]

                        if (count === 0) {
                            payer = fromAccount.publicKey;

                            const balanceSol = new BN(await connection.getBalance(payer));
                            if (balanceSol.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                                payer = zombieWalletAccount.publicKey;
                                signers = [...signers, zombieWalletAccount]
                            }
                        }

                        const toPublicKey = new PublicKey(newWalletItem.address);
                        const toTokenAccount = getAssociatedTokenAddressSync(mint, toPublicKey);
                        const walletTokenAmount = new BN(tokenAmount.toString());
                        try {
                            const info = await connection.getAccountInfo(toTokenAccount);
                            if (!info) {
                                instructions.push(
                                    createAssociatedTokenAccountInstruction(
                                        fromAccount.publicKey,
                                        toTokenAccount,
                                        toPublicKey,
                                        mint
                                    )
                                );
                            }
                        }
                        catch (err) {
                            console.log(err);
                        }

                        instructions.push(
                            createTransferInstruction(
                                fromTokenAccount,
                                toTokenAccount,
                                fromAccount.publicKey,
                                walletTokenAmount.toString()
                            )
                        );

                        const balance = await connection.getBalance(fromAccount.publicKey);
                        let required = 4100000;
                        // if (count == 0) required += 1005000;
                        if (payer === fromAccount.publicKey) required += jitoTip * LAMPORTS_PER_SOL + 1015000;

                        if (Number(balance) <= required) {
                            count++
                            continue;
                        }

                        const transferSolAmount = new BN((BigInt(balance) - BigInt(required)).toString());

                        console.log(fromAccount.publicKey.toBase58(), tokenAmount.toString(), transferSolAmount.toString())
                        instructions.push(
                            SystemProgram.transfer({
                                fromPubkey: fromAccount.publicKey,
                                toPubkey: new PublicKey(newWalletItem.address),
                                lamports: transferSolAmount.toString()
                            })
                        );

                        instructions.push(
                            SystemProgram.transfer({
                                fromPubkey: fromAccount.publicKey,
                                toPubkey: new PublicKey(getTaxWallet()),
                                lamports: LAMPORTS_PER_SOL * parseFloat(process.env.TRANSFER_TAX)
                            })
                        )

                        signers = [
                            ...signers,
                            fromAccount,
                        ];

                        count++;
                        if (count === 4) {
                            index++;
                            break;
                        }
                    }

                    if (instructions.length > 0) {
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                signers: signers,
                                payer: payer,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    signers: signers,
                                    payer: payer,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }
                    else
                        break;
                }

                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    const bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions.push(
                                CreateTraderAPITipInstruction(bundleItem[j].payer, jitoTip * LAMPORTS_PER_SOL)
                            );
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        console.log(await connection.simulateTransaction(tx))
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                await project.save();

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    console.log("Failed to transfer tokens");
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("TRANSFER_ALL_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }

            console.log("Success");

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin" && myClients[k].user.privilege == true)
                    myClients[k].emit("TRANSFER_ALL_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("TRANSFER_ALL_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("TRANSFER_ALL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("TRANSFER_ALL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.buyTokens = async (req, res) => {
    const { signedTransactions, simulateData } = req.body;
    console.log("Buying tokens...", signedTransactions, simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            let accounts = {};
            let walletTokenAccounts = {};
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (!accounts[simulateData.wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", simulateData.wallets[i].address);
                        continue;
                    }
                    accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (!accounts[project.teamWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.teamWallets[i].address);
                        continue;
                    }
                    accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            for (let i = 0; i < project.extraWallets.length; i++) {
                if (!accounts[project.extraWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.extraWallets[i].address);
                        continue;
                    }
                    accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }
            // }

            let buyItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "") {
                    try {
                        walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    buyItems.push({
                        address: simulateData.wallets[i].address,
                        tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                        solAmount: simulateData.wallets[i].sim.buy.solAmount,
                    });
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.buy.tokenAmount !== "") {
                    try {
                        walletTokenAccounts[project.teamWallets[i].address] = await getWalletTokenAccount(connection, accounts[project.teamWallets[i].address].publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    buyItems.push({
                        address: project.teamWallets[i].address,
                        tokenAmount: project.teamWallets[i].sim.buy.tokenAmount,
                        solAmount: project.teamWallets[i].sim.buy.solAmount,
                    });
                }
            }
            // }

            console.log("Buy Items:", buyItems.length, buyItems);

            const mint = new PublicKey(simulateData.token.address);
            const mintInfo = await getMint(connection, mint);

            const zombieWallet = await getZombieWallet(project);

            let lookupTableAccounts = lookupTableAccountsForProject[project._id];

            if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                const wallets = [];
                for (let i = 0; i < buyItems.length; i++) {
                    wallets.push(buyItems[i].address);
                }

                lookupTableAccounts = await registerAddressLookup(
                    connection,
                    project.poolInfo,
                    wallets,
                    zombieWallet,
                    project.lookupTableAddress
                );

                if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                    console.log("Failed to register Address Lookup.");
                    return false;
                }

                lookupTableAccountsForProject[project._id] = lookupTableAccounts
            }

            logToClients(myClients, "1. Generating bundle transactions...", false);
            let verTxns = signedTransactions ? signedTransactions.map(tx => {
                return VersionedTransaction.deserialize(Buffer.from(tx, "base64"));
            }) : [];

            for (let i = 0; i < verTxns.length; i++) {
                let sim = await connection.simulateTransaction(verTxns[i])
                console.log("\n=== Create LP sim result", sim)
            }

            let mainWallets = [];
            let solAmounts = [];
            let tokenAmounts = [];
            for (let i = 0; i < buyItems.length; i++) {
                mainWallets.push(accounts[buyItems[i].address])
                solAmounts.push(buyItems[i].solAmount);
                tokenAmounts.push(buyItems[i].tokenAmount);
            }

            const ret = await createPoolAndInitialBuy(
                connection,
                project.poolInfo,
                simulateData.token.address,
                mainWallets,
                solAmounts,
                tokenAmounts,
                signedTransactions,
                project.extraWallets,
                accounts,
                lookupTableAccounts,
                zombieWallet
            );

            if (!ret) {
                console.log("Failed to buy tokens!");
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            logToClients(myClients, "3. Transferring tokens...", false);
            let xferItemsByFrom = {};

            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                xferItemsByFrom[buyItems[0].address] = [
                    {
                        from: buyItems[0].address,
                        to: getTaxWallet(),
                        tokenAmount: new BN(mintInfo.supply.toString()).muln(PAYMENT_OPTIONS[project.paymentId].token).divn(100).toString()
                    }
                ]
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
                    continue;

                if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
                    xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                        ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
                        {
                            from: project.teamWallets[i].sim.xfer.fromAddress,
                            to: project.teamWallets[i].address,
                            tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                        }
                    ];
                }
                else {
                    xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                        {
                            from: project.teamWallets[i].sim.xfer.fromAddress,
                            to: project.teamWallets[i].address,
                            tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                        }
                    ];
                }
            }
            // }

            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].address === simulateData.wallets[i].sim.xfer.fromAddress)
                    continue;

                if (xferItemsByFrom[simulateData.wallets[i].sim.xfer.fromAddress]) {
                    xferItemsByFrom[simulateData.wallets[i].sim.xfer.fromAddress] = [
                        ...xferItemsByFrom[simulateData.wallets[i].sim.xfer.fromAddress],
                        {
                            from: simulateData.wallets[i].sim.xfer.fromAddress,
                            to: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.xfer.tokenAmount,
                        },
                    ];
                }
                else {
                    xferItemsByFrom[simulateData.wallets[i].sim.xfer.fromAddress] = [
                        {
                            from: simulateData.wallets[i].sim.xfer.fromAddress,
                            to: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.xfer.tokenAmount,
                        },
                    ];
                }
            }

            console.log(xferItemsByFrom)

            let dispersed = true;
            const USE_JITO = true;
            if (USE_JITO) {
                const jitoTip = req.user.presets.jitoTip;
                let bundleItems = [];
                let bundleIndex = -1;
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        let instructions = [];
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to].publicKey : new PublicKey(xferItems[i].to));
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    instructions.push(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to].publicKey : new PublicKey(xferItems[i].to),
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            instructions.push(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            if (bundleIndex >= 0 && bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                                bundleItems[bundleIndex].push({
                                    instructions: instructions,
                                    signers: signers,
                                    payer: accounts[from].publicKey,
                                });
                            }
                            else {
                                bundleItems.push([
                                    {
                                        instructions: instructions,
                                        signers: signers,
                                        payer: accounts[from].publicKey,
                                    }
                                ]);
                                bundleIndex++;
                            }
                        }
                        else
                            break;

                        index += count;
                    }
                }

                let dispersed = true;
                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                for (let i = 0; i < bundleItems.length; i++) {
                    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    let bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].payer, jitoTip * LAMPORTS_PER_SOL),
                                ...bundleItem[j].instructions
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    const ret = await buildBundleOnNB(verTxns);
                    if (!ret) {
                        dispersed = false;
                        break;
                    }
                }

                if (!dispersed) {
                    console.log("Failed to transfer tokens");
                    dispersed = false;
                }
            }
            else {
                let transactions = [];
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        const tx = new Transaction();
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    tx.add(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to].publicKey,
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            tx.add(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (tx.instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            transactions = [
                                ...transactions,
                                {
                                    transaction: tx,
                                    signers: signers,
                                }
                            ];
                        }
                        else
                            break;

                        index += count;
                    }
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to transfer tokens");
                        dispersed = false;
                    }
                }
            }

            console.log("Success");
            project.status = "TRADE";
            await project.save();

            const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
            const mails = await Email.find();
            let pendings = [];
            for (let i = 0; i < mails.length; i++) {
                pendings = [
                    ...pendings,
                    sendEmail({
                        to: mails[i].email,
                        subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
                        html: html
                    }, async (err, data) => {
                        if (err || data.startsWith("Error")) {
                            console.log(err);
                            return;
                        }

                        console.log('Mail sent successfully with data: ' + data);
                    })
                ];
            }

            // startMetric(project._id.toString());
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.fairBuyTokens = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Buying tokens...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            let accounts = {};
            let walletTokenAccounts = {};
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (!accounts[simulateData.wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", simulateData.wallets[i].address);
                        continue;
                    }
                    accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (!accounts[project.teamWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.teamWallets[i].address);
                        continue;
                    }
                    accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            for (let i = 0; i < project.extraWallets.length; i++) {
                if (!accounts[project.extraWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.extraWallets[i].address);
                        continue;
                    }
                    accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }
            // }

            let buyItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "") {
                    buyItems.push({
                        address: simulateData.wallets[i].address,
                        tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                        solAmount: simulateData.wallets[i].sim.buy.solAmount,
                    });
                }
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.buy.tokenAmount !== "") {
                    buyItems.push({
                        address: project.teamWallets[i].address,
                        tokenAmount: project.teamWallets[i].sim.buy.tokenAmount,
                        solAmount: project.teamWallets[i].sim.buy.solAmount,
                    });
                }
            }

            for (let i = 0; i < project.extraWallets.length; i++) {
                if (project.extraWallets[i].sim.buy.tokenAmount !== "") {
                    buyItems.push({
                        address: project.extraWallets[i].address,
                        tokenAmount: project.extraWallets[i].sim.buy.tokenAmount,
                        solAmount: project.extraWallets[i].sim.buy.solAmount,
                    });
                }
            }
            // }

            console.log("Buy Items:", buyItems.length, buyItems);

            const zombieWallet = await getZombieWallet(project);
            const mint = new PublicKey(simulateData.token.address);
            let mintInfo = null;
            mintInfo = await getMint(connection, mint);
            if (mintInfo == null) {
                console.log("Failed to buy tokens");
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }
            console.log(mintInfo.freezeAuthority.toBase58())
            const authorityItem = await Wallet.findOne({ address: mintInfo.freezeAuthority.toBase58() });
            if (!authorityItem) {
                console.log("Invalid wallet:", mintInfo.freezeAuthority.toBase58());
                return;
            }
            const freezeAuthority = Keypair.fromSecretKey(bs58.decode(authorityItem.privateKey));

            logToClients(myClients, "1. Generating bundle transactions...", false);
            await sleep(10000);

            const poolKeys = jsonInfo2PoolKeys(project.poolInfo);
            let recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            let verTxns = []
            const jitoTip = req.user.presets.jitoTip;
            for (let i = 0; i < buyItems.length; i++) {
                let instructions = [];
                const thawInstruction = createThawAccountInstruction(
                    new PublicKey(project.poolInfo.baseVault),
                    mint,
                    freezeAuthority.publicKey
                )
                const buyInstructions = await getBuyTokenInstructions(
                    connection,
                    poolKeys,
                    simulateData.token.address,
                    mintInfo.decimals,
                    buyItems[i].solAmount,
                    buyItems[i].tokenAmount,
                    accounts[buyItems[i].address].publicKey,
                    true
                )
                const freezeInstruction = createFreezeAccountInstruction(
                    new PublicKey(project.poolInfo.baseVault),
                    mint,
                    freezeAuthority.publicKey
                )
                instructions = [thawInstruction, ...buyInstructions, freezeInstruction];
                const transactionMessage = new TransactionMessage({
                    payerKey: accounts[buyItems[i].address].publicKey,
                    instructions,
                    recentBlockhash,
                });
                const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                tx.sign([accounts[buyItems[i].address], freezeAuthority]);
                verTxns.push(tx);
                if ((i + 1) % (BUNDLE_TX_LIMIT - 1) == 0 || i == buyItems.length - 1) {
                    const tipTx = await buildNBTipTransaction(accounts[buyItems[i].address], jitoTip)
                    verTxns.push(tipTx);
                    const ret = await buildBundleOnNBAndConfirmTxId(connection, verTxns, "confirmed");

                    if (!ret) {
                        console.log("Failed to buy tokens");
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                    // await sleep(500)
                    recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    verTxns = [];
                }
            }

            logToClients(myClients, "2. Transferring tokens, thaw pool and revoking freeze authority...", false);

            let instructions = []
            let signers = []
            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[buyItems[0].address].publicKey);

                const toTokenAccount = getAssociatedTokenAddressSync(mint, new PublicKey(getTaxWallet()));
                try {
                    const info = await connection.getAccountInfo(toTokenAccount);
                    if (!info) {
                        instructions.push(
                            createAssociatedTokenAccountInstruction(
                                accounts[buyItems[0].address].publicKey,
                                toTokenAccount,
                                new PublicKey(getTaxWallet()),
                                mint
                            )
                        );
                    }
                }
                catch (err) {
                    console.log(err);
                }

                instructions.push(
                    createTransferInstruction(
                        fromTokenAccount,
                        toTokenAccount,
                        accounts[buyItems[0].address].publicKey,
                        new BN(mintInfo.supply.toString()).muln(PAYMENT_OPTIONS[project.paymentId].token).divn(100).toString()
                    )
                );
                signers.push(accounts[buyItems[0].address]);
            }
            instructions.push(
                createThawAccountInstruction(
                    new PublicKey(project.poolInfo.baseVault),
                    mint,
                    zombieWallet.publicKey
                )
            )
            instructions.push(
                createSetAuthorityInstruction(mint, freezeAuthority.publicKey, AuthorityType.FreezeAccount, null)
            )
            signers.push(freezeAuthority, zombieWallet);
            recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            const tx = new VersionedTransaction(
                new TransactionMessage({
                    payerKey: zombieWallet.publicKey,
                    instructions,
                    recentBlockhash,
                }).compileToV0Message()
            )
            tx.sign(signers);

            const tipTx = await buildNBTipTransaction(zombieWallet, 0.001)
            const ret = await buildBundleOnNBAndConfirmTxId(connection, [tx, tipTx])
            if (!ret) {
                console.log("Failed to buy tokens");
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            console.log("Success");
            project.status = "TRADE";
            await project.save();

            const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
            const mails = await Email.find();
            let pendings = [];
            for (let i = 0; i < mails.length; i++) {
                pendings = [
                    ...pendings,
                    sendEmail({
                        to: mails[i].email,
                        subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
                        html: html
                    }, async (err, data) => {
                        if (err || data.startsWith("Error")) {
                            console.log(err);
                            return;
                        }

                        console.log('Mail sent successfully with data: ' + data);
                    })
                ];
            }

            // startMetric(project._id.toString());
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.unfreezePool = async (req, res) => {
    const { projectId } = req.body;
    console.log("unfreeze pool...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const zombieWallet = await getZombieWallet(project);

            const mint = new PublicKey(project.token.address);
            const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
            const freezeAuthorityItem = await Wallet.findOne({ address: mintInfo.freezeAuthority.toBase58() });
            if (!freezeAuthorityItem) {
                console.log("Invalid freeze authority:", mintInfo.freezeAuthority.toBase58());
                return;
            }
            const freezeAuthority = Keypair.fromSecretKey(bs58.decode(freezeAuthorityItem.privateKey));
            const jitoTip = req.user.presets.jitoTip

            logToClients(myClients, "1. Generating bundle transactions...", false);

            let instructions = [];

            if (project.token.authority && project.token.authority != "") {
                const thawInstruction = createThawAccountInstruction(
                    new PublicKey(project.poolInfo.vaultB),
                    mint,
                    freezeAuthority.publicKey,
                    [],
                    TOKEN_2022_PROGRAM_ID
                )
                instructions.push(thawInstruction)
                instructions.push(
                    createSetAuthorityInstruction(
                        mint,
                        freezeAuthority.publicKey,
                        AuthorityType.FreezeAccount,
                        null,
                        [],
                        TOKEN_2022_PROGRAM_ID
                    )
                )
            } else {
                const thawInstruction = createThawAccountInstruction(
                    new PublicKey(project.poolInfo.baseVault),
                    mint,
                    freezeAuthority.publicKey
                )
                instructions.push(thawInstruction)
                instructions.push(
                    createSetAuthorityInstruction(
                        mint,
                        freezeAuthority.publicKey,
                        AuthorityType.FreezeAccount,
                        null,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                )
            }

            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            const transactionMessage = new TransactionMessage({
                payerKey: zombieWallet.publicKey,
                instructions,
                recentBlockhash,
            });
            const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
            tx.sign([zombieWallet, freezeAuthority]);
            const tipTx = await buildNBTipTransaction(zombieWallet, jitoTip)
            const ret = await buildBundleOnNB([tx, tipTx]);
            if (!ret) {
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
            }
            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.burnTaxToken = async (req, res) => {
    const { projectId, amount } = req.body;
    console.log("burning tax...", projectId);
    try {
        const project = await Project.findById(projectId);
        if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || !project.token.authority) {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const authorityWallet = await Wallet.findOne({ address: project.token.authority });

            const authorityAccount = Keypair.fromSecretKey(bs58.decode(authorityWallet.privateKey));

            const mint = new PublicKey(project.token.address);

            const ata = getAssociatedTokenAddressSync(mint, authorityAccount.publicKey, false, TOKEN_2022_PROGRAM_ID)

            logToClients(myClients, "1. Generating bundle transactions...", false);

            let instructions = [];

            instructions.push(
                createBurnInstruction(
                    ata,
                    mint,
                    authorityAccount.publicKey,
                    amount,
                    [],
                    TOKEN_2022_PROGRAM_ID
                )
            )

            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            const transactionMessage = new TransactionMessage({
                payerKey: authorityAccount.publicKey,
                instructions,
                recentBlockhash,
            });
            const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
            tx.sign([authorityAccount]);
            const ret = await buildTxOnNB(tx, authorityAccount, req.user.presets.jitoTip);
            if (!ret) {
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BURN_COMPLETED", JSON.stringify({ message: "Failed" }));
            }

            for (let k = 0; k < myClients.length; k++) {
                myClients[k].emit("BURN_COMPLETED", JSON.stringify({ message: "OK" }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BURN_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

// exports.mintAndSnipePumpfunTokens = async (req, res) => {
//     const { simulateData } = req.body;
//     console.log("Buying tokens...", simulateData);
//     try {
//         const project = await Project.findById(simulateData.projectId);
//         if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
//             console.log("Mismatched user id or Not activated project!");
//             res.status(401).json({
//                 success: false,
//                 error: "User ID mismatch Or Not activated project",
//             });
//             return;
//         }

//         res.status(200).json({
//             success: true
//         });

//         const clients = getWebSocketClientList();
//         const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
//         try {
//             const { connection } = useConnection();

//             const jitoTip = req.user.presets.jitoTip;
//             console.log("Jito Tip:", jitoTip);

//             let accounts = {};
//             let walletTokenAccounts = {};
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (!accounts[simulateData.wallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", simulateData.wallets[i].address);
//                         continue;
//                     }
//                     accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (!accounts[project.teamWallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", project.teamWallets[i].address);
//                         continue;
//                     }
//                     accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }

//             for (let i = 0; i < project.extraWallets.length; i++) {
//                 if (!accounts[project.extraWallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", project.extraWallets[i].address);
//                         continue;
//                     }
//                     accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }
//             // }

//             let buyItems = [];
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (simulateData.wallets[i].sim.buy.tokenAmount !== "") {
//                     try {
//                         walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
//                     }
//                     catch (err) {
//                         console.log(err);
//                         logToClients(myClients, err, true);
//                         for (let k = 0; k < myClients.length; k++)
//                             myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                         return;
//                     }

//                     buyItems.push({
//                         address: simulateData.wallets[i].address,
//                         tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
//                         solAmount: simulateData.wallets[i].sim.buy.solAmount,
//                     });
//                 }
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.buy.tokenAmount !== "") {
//                     try {
//                         walletTokenAccounts[project.teamWallets[i].address] = await getWalletTokenAccount(connection, accounts[project.teamWallets[i].address].publicKey);
//                     }
//                     catch (err) {
//                         console.log(err);
//                         logToClients(myClients, err, true);
//                         for (let k = 0; k < myClients.length; k++)
//                             myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                         return;
//                     }

//                     buyItems.push({
//                         address: project.teamWallets[i].address,
//                         tokenAmount: project.teamWallets[i].sim.buy.tokenAmount,
//                         solAmount: project.teamWallets[i].sim.buy.solAmount,
//                     });
//                 }
//             }
//             // }

//             console.log("accounts: ", accounts)
//             console.log("walletTokenAccounts: ", walletTokenAccounts)
//             console.log("Buy Items:", buyItems.length);


//             logToClients(myClients, "1. Generating bundle transactions...", false);

//             const signerKeypair = accounts[buyItems[0].address];

//             const tokenMint = simulateData.token.address;
//             const tokenName = project.token.name;
//             const tokenSymbol = project.token.symbol;
//             const tokenUri = project.token.tokenUri;

//             const keyArray = JSON.parse(project.token.privateKey)
//             const privkey = new Uint8Array(keyArray)
//             const keypair = Keypair.fromSecretKey(privkey)

//             const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))

//             // Create an AnchorProvider instance
//             const provider = new anchor.AnchorProvider(
//                 connection,
//                 new anchor.Wallet(signerKeypair),
//                 anchor.AnchorProvider.defaultOptions()
//             );

//             const pumpSDK = new PumpSdk(connection);

//             // const program = new anchor.Program(idl, programID, provider);
//             const program = getPumpProgram(connection, new PublicKey(programID));

//             // Create a Lookup Table
//             let pumpPoolKeys = await getPumpPoolKeys(program, new PublicKey(tokenMint))
//             let allPubKeys = [
//                 new PublicKey(programID),
//                 new PublicKey(MEMO_PROGRAM_ID),
//                 new PublicKey(feeRecipient),
//                 new PublicKey(EVENT_AUTH),
//                 NATIVE_MINT,
//                 TOKEN_PROGRAM_ID,
//                 ASSOCIATED_TOKEN_PROGRAM_ID,
//                 tokenAccount.publicKey,
//                 SYSVAR_RENT_PUBKEY,
//                 new PublicKey("ComputeBudget111111111111111111111111111111"),  // Compute Budget
//                 new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), // global state
//                 new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
//                 SystemProgram.programId
//             ]
//             allPubKeys = [...allPubKeys, ...pumpPoolKeys]

//             const zombieWallet = await getZombieWallet(project);

//             for (let idx = 0; idx < buyItems.length; idx++) {
//                 const wallet = new PublicKey(buyItems[idx].address);
//                 const tokenAccount = await getAssociatedTokenAddress(
//                     new PublicKey(tokenMint),
//                     wallet
//                 );
//                 const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
//                 allPubKeys.push(wallet);
//                 allPubKeys.push(tokenAccount);
//                 allPubKeys.push(wrappedAccount);
//             }

//             // const firstAddressLookup = await createAddressLookupWithAddressList(
//             //     connection,
//             //     allPubKeys,
//             //     zombieWallet
//             // );

//             // if (!firstAddressLookup) return null;
//             const firstAddressLookup = new PublicKey("Ej3wFtgk3WywPnWPD3aychk38MqTdrjtqXkzbK8FpUih")

//             await sleep(5000);

//             const lookupTableAccounts = [];

//             const startTime = Date.now();
//             const TIMEOUT = 30000;
//             let lookupTableAccount = null;

//             // while (Date.now() - startTime < TIMEOUT) {
//             //     console.log("---- verifing lookup Table", firstAddressLookup)
//             lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

//             //     if (lookupTableAccount.value && lookupTableAccount.value.state && lookupTableAccount.value.state.addresses.length >= allPubKeys.length) {
//             //         console.log(`https://explorer.solana.com/address/${firstAddressLookup.toString()}/entries?cluster=mainnet`)
//             //         break;
//             //     }
//             //     await sleep(1000)
//             // }

//             lookupTableAccounts.push(lookupTableAccount.value);

//             if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
//                 logToClients(myClients, "Failed to register Address Lookup.", false);
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return false;
//             }

//             // Jito Configuration
//             let innerTxns = [];
//             let instructions = [];
//             let zombieKeypairList = [];
//             let instructionCount = 0;

//             let verTxns = [];

//             while (true) {
//                 try {
//                     const balance = await connection.getBalance(new PublicKey(buyItems[0].address));
//                     if (balance > 1000000) break;
//                     console.log(balance)
//                 } catch (err) {
//                     console.log(err)
//                     await sleep(4000)
//                 }
//             }

//             for (let i = 0; i < buyItems.length; i++) {
//                 const zombieKeypair = accounts[buyItems[i].address];

//                 const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
//                 const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL;
//                 const unitSlippage = 10 / 100;
//                 const numberAmount = maxSolCost / (1 + unitSlippage);
//                 const tokenAmount = buyItems[i].tokenAmount;

//                 if (i === 0) {
//                     // Mint Transaction
//                     const txMint = await buildMintTx(
//                         program,
//                         zombieKeypair,
//                         new PublicKey(tokenMint),
//                         tokenName,
//                         tokenSymbol,
//                         tokenUri
//                     );

//                     //Buy Transaction
//                     const txBuyDev = await buildMintBuyTx(
//                         program,
//                         connection,
//                         zombieKeypair,
//                         tokenMint,
//                         numberAmount,
//                         maxSolCost,
//                         tokenAmount,
//                         zombieKeypair.publicKey
//                     );

//                     instructions = [...txMint.instructions, ...txBuyDev.instructions];
//                     zombieKeypairList = [signerKeypair, tokenAccount];
//                     instructionCount += 3;

//                     if (buyItems.length === 1) {
//                         /* Add Tip Instruction */
//                         let newInnerTransactions = [];
//                         newInnerTransactions.push(
//                             CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
//                         )

//                         instructions.push(...newInnerTransactions);

//                         innerTxns.push({
//                             txns: [...instructions],
//                             signers: [...zombieKeypairList],
//                             payer: signerKeypair,
//                         });
//                     }
//                 }
//                 else {
//                     //Buy Transaction
//                     const txBuyZombie = await buildMintBuyTx(
//                         program,
//                         connection,
//                         zombieKeypair,
//                         tokenMint.toString(),
//                         numberAmount,
//                         maxSolCost,
//                         tokenAmount,
//                         accounts[buyItems[0].address].publicKey,
//                     );

//                     if (i === buyItems.length - 1) {
//                         /* Add Tip Instruction */
//                         let newInnerTransactions = [...txBuyZombie.instructions];
//                         // newInnerTransactions.push(
//                         //     CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
//                         // )

//                         // add to instructions
//                         instructions.push(...newInnerTransactions);
//                         zombieKeypairList.push(zombieKeypair);

//                         // add to innerTxns
//                         innerTxns.push({
//                             txns: [
//                                 CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip),
//                                 ...instructions
//                             ],
//                             signers: [...zombieKeypairList],
//                             payer: zombieKeypairList[0],
//                         });

//                         instructions = [];
//                         zombieKeypairList = [];
//                         instructionCount = 0;
//                     }
//                     else {

//                         // add to instructions
//                         instructions.push(...txBuyZombie.instructions);
//                         zombieKeypairList.push(zombieKeypair);
//                         instructionCount++;

//                         if (instructionCount >= process.env.INSTRUCTION_LIMIT) {
//                             console.log("instructionCount", instructionCount)
//                             innerTxns.push({
//                                 txns: [...instructions],
//                                 signers: [...zombieKeypairList],
//                                 payer: zombieKeypairList[0],
//                             });

//                             instructions = [];
//                             zombieKeypairList = [];
//                             instructionCount = 0;
//                         }
//                     }
//                 }
//             }

//             let extraInnerTxns = [];
//             instructions = []
//             zombieKeypairList = []
//             console.log("-------Extra Wallets", project.extraWallets)
//             for (let i = 0; i < project.extraWallets.length; i++) {
//                 const zombieKeypair = accounts[project.extraWallets[i].address];
//                 console.log(zombieKeypair)

//                 const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
//                 const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL - 0.02;
//                 const unitSlippage = 10 / 100;
//                 const numberAmount = maxSolCost / (1 + unitSlippage);
//                 const tokenAmount = project.extraWallets[i].sim.buy.tokenAmount;
//                 const solRequired = Number(project.extraWallets[i].sim.buy.solAmount) / LAMPORTS_PER_SOL;

//                 if (maxSolCost < solRequired) continue;

//                 const txBuyZombie = await buildMintBuyTx(
//                     program,
//                     connection,
//                     zombieKeypair,
//                     tokenMint.toString(),
//                     numberAmount,
//                     maxSolCost,
//                     tokenAmount,
//                     accounts[buyItems[0].address].publicKey
//                 );

//                 let newInnerTransactions = [...txBuyZombie.instructions];
//                 instructions.push(...newInnerTransactions);
//                 zombieKeypairList.push(zombieKeypair);
//             }

//             if (zombieKeypairList.length > 0) {
//                 extraInnerTxns.push({
//                     txns: [...instructions],
//                     signers: [...zombieKeypairList],
//                     payer: zombieKeypairList[0],
//                 });
//             }

//             logToClients(myClients, "2. Submitting bundle transactions...", false);

//             console.log("Sending compressed trxs")

//             const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

//             for (let i = 0; i < innerTxns.length; i++) {
//                 verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...innerTxns[i].txns], recentBlockhash, [...innerTxns[i].signers], innerTxns[i].payer))
//             }

//             try {
//                 for (let i = 0; i < extraInnerTxns.length; i++) {
//                     verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...extraInnerTxns[i].txns], recentBlockhash, [...extraInnerTxns[i].signers], extraInnerTxns[i].payer))
//                 }
//             } catch (error) {
//                 console.log(error);
//             }

//             const ret = await buildBundleOnNBAndConfirmTxId(connection, verTxns, "finalized");

//             if (!ret) {
//                 console.log("Failed to buy tokens!");
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return;
//             }

//             const curPumpKeyPair = await PumpKeyPair.findOne({ publicKey: { $eq: tokenMint } });
//             if (curPumpKeyPair && !curPumpKeyPair.isUsed) {
//                 curPumpKeyPair.isUsed = true;
//                 await curPumpKeyPair.save();
//             }

//             logToClients(myClients, "3. Transferring tokens...", false);

//             const wallets = project.wallets.filter(item => item.sim.enabled);
//             const mint = new PublicKey(project.token.address);

//             let xferItemsByFrom = {};
//             if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
//                 if (buyItems.length >= 2)
//                     xferItemsByFrom[buyItems[1].address] = [
//                         {
//                             from: buyItems[1].address,
//                             to: getTaxWallet(),
//                             tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
//                         }
//                     ]
//                 else
//                     xferItemsByFrom[buyItems[0].address] = [
//                         {
//                             from: buyItems[0].address,
//                             to: getTaxWallet(),
//                             tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
//                         }
//                     ]
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
//                     continue;

//                 const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.teamWallets[i].address].publicKey);

//                 let tokenBalance = null;
//                 try {
//                     const tokenAccountInfo = await getAccount(connection, associatedToken);
//                     tokenBalance = new BN(tokenAccountInfo.amount);
//                 }
//                 catch (err) {
//                     console.log(err);
//                 }

//                 if (!tokenBalance || tokenBalance.lt(new BN(project.teamWallets[i].sim.xfer.tokenAmount))) {
//                     if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
//                         xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
//                             ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
//                             {
//                                 from: project.teamWallets[i].sim.xfer.fromAddress,
//                                 to: project.teamWallets[i].address,
//                                 tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
//                             }
//                         ];
//                     }
//                     else {
//                         xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
//                             {
//                                 from: project.teamWallets[i].sim.xfer.fromAddress,
//                                 to: project.teamWallets[i].address,
//                                 tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
//                             }
//                         ];
//                     }
//                 }
//             }
//             // }

//             for (let i = 0; i < wallets.length; i++) {
//                 if (wallets[i].address === wallets[i].sim.xfer.fromAddress)
//                     continue;

//                 const associatedToken = getAssociatedTokenAddressSync(mint, accounts[wallets[i].address].publicKey);



//                 let tokenBalance = null;
//                 try {
//                     const tokenAccountInfo = await getAccount(connection, associatedToken);
//                     tokenBalance = new BN(tokenAccountInfo.amount);
//                 }
//                 catch (err) {
//                     // console.log(err);
//                 }

//                 if (!tokenBalance || tokenBalance.lt(new BN(wallets[i].sim.xfer.tokenAmount))) {
//                     if (xferItemsByFrom[wallets[i].sim.xfer.fromAddress]) {
//                         xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
//                             ...xferItemsByFrom[wallets[i].sim.xfer.fromAddress],
//                             {
//                                 from: wallets[i].sim.xfer.fromAddress,
//                                 to: wallets[i].address,
//                                 tokenAmount: wallets[i].sim.xfer.tokenAmount,
//                             },
//                         ];
//                     }
//                     else {
//                         xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
//                             {
//                                 from: wallets[i].sim.xfer.fromAddress,
//                                 to: wallets[i].address,
//                                 tokenAmount: wallets[i].sim.xfer.tokenAmount,
//                             },
//                         ];
//                     }
//                 }
//             }

//             console.log("xferItemsByFrom: ", xferItemsByFrom)

//             let dispersed = true;
//             const USE_JITO = true;
//             if (USE_JITO) {
//                 let bundleItems = [];
//                 let bundleIndex = -1;
//                 for (let from in xferItemsByFrom) {
//                     const signers = [accounts[from]];
//                     let xferItems = xferItemsByFrom[from];
//                     let index = 0;
//                     while (index < xferItems.length) {
//                         let count = 0;
//                         let instructions = [];
//                         for (let i = index; i < xferItems.length; i++) {
//                             const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
//                             if (!fromTokenAccount)
//                                 continue;

//                             const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to));
//                             try {
//                                 await sleep(20);
//                                 const info = await connection.getAccountInfo(toTokenAccount);
//                                 if (!info) {
//                                     instructions.push(
//                                         createAssociatedTokenAccountInstruction(
//                                             accounts[from].publicKey,
//                                             toTokenAccount,
//                                             accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to),
//                                             mint
//                                         )
//                                     );
//                                 }
//                             }
//                             catch (err) {
//                                 console.log(err);
//                             }

//                             instructions.push(
//                                 createTransferInstruction(
//                                     fromTokenAccount,
//                                     toTokenAccount,
//                                     accounts[xferItems[i].from].publicKey,
//                                     xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
//                                 )
//                             );

//                             count++;
//                             if (count === 5)
//                                 break;
//                         }

//                         if (instructions.length > 0) {
//                             console.log("Transferring tokens...", from, index, index + count - 1);
//                             if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
//                                 bundleItems[bundleIndex].push({
//                                     instructions: instructions,
//                                     signers: signers,
//                                     payer: accounts[from].publicKey,
//                                 });
//                             }
//                             else {
//                                 bundleItems.push([
//                                     {
//                                         instructions: instructions,
//                                         signers: signers,
//                                         payer: accounts[from].publicKey,
//                                     }
//                                 ]);
//                                 bundleIndex++;
//                             }
//                         }
//                         else
//                             break;

//                         index += count;
//                     }
//                 }

//                 console.log("Bundle Items:", bundleItems.length);
//                 let bundleTxns = [];
//                 const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//                 for (let i = 0; i < bundleItems.length; i++) {
//                     let bundleItem = bundleItems[i];
//                     console.log("Bundle", i, bundleItem.length);
//                     let verTxns = [];
//                     for (let j = 0; j < bundleItem.length; j++) {
//                         if (j === bundleItem.length - 1) {
//                             bundleItem[j].instructions = [
//                                 CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
//                                 ...bundleItem[j].instructions
//                             ];
//                         }
//                         const transactionMessage = new TransactionMessage({
//                             payerKey: bundleItem[j].payer,
//                             instructions: bundleItem[j].instructions,
//                             recentBlockhash,
//                         });
//                         const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
//                         tx.sign(bundleItem[j].signers);
//                         verTxns.push(tx);
//                     }

//                     bundleTxns.push(verTxns);
//                 }

//                 const ret = await buildBundlesOnNB(bundleTxns);
//                 if (!ret) {
//                     console.log("Failed to transfer tokens");
//                     dispersed = false;
//                 }
//             }
//             else {
//                 let transactions = [];
//                 for (let from in xferItemsByFrom) {
//                     const signers = [accounts[from]];
//                     let xferItems = xferItemsByFrom[from];
//                     let index = 0;
//                     while (index < xferItems.length) {
//                         let count = 0;
//                         const tx = new Transaction();
//                         for (let i = index; i < xferItems.length; i++) {
//                             const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
//                             if (!fromTokenAccount)
//                                 continue;

//                             const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
//                             try {
//                                 const info = await connection.getAccountInfo(toTokenAccount);
//                                 if (!info) {
//                                     tx.add(
//                                         createAssociatedTokenAccountInstruction(
//                                             accounts[from].publicKey,
//                                             toTokenAccount,
//                                             accounts[xferItems[i].to].publicKey,
//                                             mint
//                                         )
//                                     );
//                                 }
//                             }
//                             catch (err) {
//                                 console.log(err);
//                             }

//                             tx.add(
//                                 createTransferInstruction(
//                                     fromTokenAccount,
//                                     toTokenAccount,
//                                     accounts[xferItems[i].from].publicKey,
//                                     xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
//                                 )
//                             );

//                             count++;
//                             if (count === 5)
//                                 break;
//                         }

//                         if (tx.instructions.length > 0) {
//                             console.log("Transferring tokens...", from, index, index + count - 1);
//                             transactions = [
//                                 ...transactions,
//                                 {
//                                     transaction: tx,
//                                     signers: signers,
//                                 }
//                             ];
//                         }
//                         else
//                             break;

//                         index += count;
//                     }
//                 }

//                 if (transactions.length > 0) {
//                     const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
//                     if (!ret) {
//                         console.log("Failed to transfer tokens");
//                         dispersed = false;
//                     }
//                 }
//             }

//             console.log("Success");
//             project.status = "TRADE";
//             await project.save();

//             const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
//             const mails = await Email.find();
//             let pendings = [];
//             for (let i = 0; i < mails.length; i++) {
//                 pendings = [
//                     ...pendings,
//                     sendEmail({
//                         to: mails[i].email,
//                         subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
//                         html: html
//                     }, async (err, data) => {
//                         if (err || data.startsWith("Error")) {
//                             console.log(err);
//                             return;
//                         }

//                         console.log('Mail sent successfully with data: ' + data);
//                     })
//                 ];
//             }

//             // startMetric(project._id.toString());
//             const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//             for (let k = 0; k < myClients.length; k++) {
//                 if (myClients[k].user.role === "admin")
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//                 else
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
//             }
//         }
//         catch (err) {
//             logToClients(myClients, err, true);
//             for (let k = 0; k < myClients.length; k++)
//                 myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//         }
//     }
//     catch (err) {
//         console.log(err);
//         res.status(401).json({
//             success: false,
//             error: "Unknown error",
//         });
//     }
// }

// exports.mintAndBuyPumpfunTokens = async (req, res) => {
//     const { simulateData } = req.body;
//     console.log("Mint & Buying tokens...", simulateData);
//     try {
//         const project = await Project.findById(simulateData.projectId);
//         if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || project.status !== "OPEN") {
//             console.log("Mismatched user id or Not activated project!");
//             res.status(401).json({
//                 success: false,
//                 error: "User ID mismatch Or Not activated project",
//             });
//             return;
//         }

//         res.status(200).json({
//             success: true
//         });

//         const clients = getWebSocketClientList();
//         const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
//         try {
//             const { connection } = useConnection();

//             const jitoTip = req.user.presets.jitoTip;
//             console.log("Jito Tip:", jitoTip);

//             let accounts = {};
//             let walletTokenAccounts = {};
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (!accounts[simulateData.wallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", simulateData.wallets[i].address);
//                         continue;
//                     }
//                     accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }

//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (!accounts[project.teamWallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", project.teamWallets[i].address);
//                         continue;
//                     }
//                     accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }

//             for (let i = 0; i < project.extraWallets.length; i++) {
//                 if (!accounts[project.extraWallets[i].address]) {
//                     const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
//                     if (!walletItem) {
//                         console.log("Invalid wallet:", project.extraWallets[i].address);
//                         continue;
//                     }
//                     accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
//                 }
//             }

//             let buyItems = [];
//             for (let i = 0; i < simulateData.wallets.length; i++) {
//                 if (simulateData.wallets[i].sim.buy.tokenAmount !== "" && simulateData.wallets[i].sim.buy.tokenAmount !== "0") {
//                     try {
//                         walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
//                     }
//                     catch (err) {
//                         console.log(err);
//                         logToClients(myClients, err, true);
//                         for (let k = 0; k < myClients.length; k++)
//                             myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                         return;
//                     }

//                     if (buyItems.length == 0) {
//                         buyItems.push({
//                             address: simulateData.wallets[i].address,
//                             tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
//                             initialTokenAmount: simulateData.wallets[i].initialTokenAmount,
//                             solAmount: simulateData.wallets[i].sim.buy.solAmount,
//                         });
//                     } else {
//                         buyItems.push({
//                             address: simulateData.wallets[i].address,
//                             tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
//                             solAmount: simulateData.wallets[i].sim.buy.solAmount,
//                         });
//                     }
//                 }
//             }

//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.buy.tokenAmount !== "" && project.teamWallets[i].sim.buy.tokenAmount !== "0") {
//                     try {
//                         walletTokenAccounts[project.teamWallets[i].address] = await getWalletTokenAccount(connection, accounts[project.teamWallets[i].address].publicKey);
//                     }
//                     catch (err) {
//                         console.log(err);
//                         logToClients(myClients, err, true);
//                         for (let k = 0; k < myClients.length; k++)
//                             myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                         return;
//                     }

//                     buyItems.push({
//                         address: project.teamWallets[i].address,
//                         tokenAmount: project.teamWallets[i].sim.buy.tokenAmount,
//                         solAmount: project.teamWallets[i].sim.buy.solAmount,
//                     });
//                 }
//             }

//             console.log("accounts: ", accounts)
//             console.log("walletTokenAccounts: ", walletTokenAccounts)
//             console.log("Buy Items:", buyItems.length);


//             logToClients(myClients, "1. Generating bundle transactions...", false);

//             const signerKeypair = accounts[buyItems[0].address];

//             const tokenMint = simulateData.token.address;
//             const tokenName = project.token.name;
//             const tokenSymbol = project.token.symbol;
//             const tokenUri = project.token.tokenUri;

//             const keyArray = JSON.parse(project.token.privateKey)
//             const privkey = new Uint8Array(keyArray)
//             const keypair = Keypair.fromSecretKey(privkey)

//             const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))

//             // Create an AnchorProvider instance
//             const provider = new anchor.AnchorProvider(
//                 connection,
//                 new anchor.Wallet(signerKeypair),
//                 anchor.AnchorProvider.defaultOptions()
//             );

//             // const program = new anchor.Program(idl, programID, provider);
//             const program = getPumpProgram(connection, new PublicKey(programID));

//             // Create a Lookup Table
//             // let pumpPoolKeys = await getPumpPoolKeys(program, new PublicKey(tokenMint))
//             // let allPubKeys = [
//             //     new PublicKey(programID),
//             //     new PublicKey(MEMO_PROGRAM_ID),
//             //     new PublicKey(feeRecipient),
//             //     new PublicKey(EVENT_AUTH),
//             //     NATIVE_MINT,
//             //     TOKEN_PROGRAM_ID,
//             //     ASSOCIATED_TOKEN_PROGRAM_ID,
//             //     tokenAccount.publicKey,
//             //     SYSVAR_RENT_PUBKEY,
//             //     new PublicKey("ComputeBudget111111111111111111111111111111"),  // Compute Budget
//             //     new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), // global state
//             //     new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
//             //     SystemProgram.programId
//             // ]
//             // allPubKeys = [...allPubKeys, ...pumpPoolKeys]

//             // const zombieWallet = await getZombieWallet(project);

//             // for (let idx = 0; idx < buyItems.length; idx++) {
//             //     const wallet = new PublicKey(buyItems[idx].address);
//             //     const tokenAccount = await getAssociatedTokenAddress(
//             //         new PublicKey(tokenMint),
//             //         wallet
//             //     );
//             //     const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
//             //     allPubKeys.push(wallet);
//             //     allPubKeys.push(tokenAccount);
//             //     allPubKeys.push(wrappedAccount);
//             // }

//             // const firstAddressLookup = await createAddressLookupWithAddressList(
//             //     connection,
//             //     allPubKeys,
//             //     zombieWallet
//             // );

//             // if (!firstAddressLookup) return null;
//             const firstAddressLookup = new PublicKey("Ej3wFtgk3WywPnWPD3aychk38MqTdrjtqXkzbK8FpUih")

//             await sleep(5000);

//             const lookupTableAccounts = [];

//             // const startTime = Date.now();
//             // const TIMEOUT = 30000;
//             let lookupTableAccount = null;

//             // while (Date.now() - startTime < TIMEOUT) {
//             //     console.log("---- verifing lookup Table", firstAddressLookup)
//             lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

//             //     if (lookupTableAccount.value && lookupTableAccount.value.state && lookupTableAccount.value.state.addresses.length >= allPubKeys.length) {
//             //         console.log(`https://explorer.solana.com/address/${firstAddressLookup.toString()}/entries?cluster=mainnet`)
//             //         break;
//             //     }
//             //     await sleep(1000)
//             // }

//             lookupTableAccounts.push(lookupTableAccount.value);

//             if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
//                 logToClients(myClients, "Failed to register Address Lookup.", false);
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return false;
//             }

//             // Jito Configuration
//             let mintTx;

//             let innerTxns = [];
//             let instructions = [];
//             let zombieKeypairList = [];
//             let instructionCount = 0;

//             for (let i = 0; i < buyItems.length; i++) {
//                 const zombieKeypair = accounts[buyItems[i].address];

//                 const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
//                 const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL;
//                 const unitSlippage = 10 / 100;
//                 const numberAmount = maxSolCost / (1 + unitSlippage);
//                 const tokenAmount = buyItems[i].tokenAmount;
//                 const solAmount = Math.ceil(Number(buyItems[i].solAmount) * 100 / 99) / LAMPORTS_PER_SOL;

//                 if (i == 0) {
//                     const token_metadata = {
//                         'name': tokenName,
//                         'symbol': tokenSymbol,
//                         'uri': tokenUri
//                     }

//                     const response = await fetch("https://pumpportal.fun/api/trade-local", {
//                         method: "POST",
//                         headers: {
//                             "Content-Type": "application/json",
//                         },
//                         body: JSON.stringify({
//                             'publicKey': signerKeypair.publicKey.toString(),
//                             'action': 'create',
//                             'tokenMetadata': token_metadata,
//                             'mint': tokenAccount.publicKey.toString(),
//                             'denominatedInSol': 'false',
//                             'amount': tokenAmount,
//                             'slippage': 10,
//                             'priorityFee': 0.0005,
//                             'pool': 'pump'
//                         }),
//                     })

//                     const data = await response.arrayBuffer();
//                     mintTx = VersionedTransaction.deserialize(new Uint8Array(data));
//                     mintTx.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
//                     mintTx.sign([signerKeypair, tokenAccount])
//                 }

//                 // if (i === 0) {
//                 //     if (tokenAmount - buyItems[0].initialTokenAmount == 0) continue;

//                 //     const txBuyDev = await buildMintBuyTx(
//                 //         program,
//                 //         signerKeypair,
//                 //         tokenMint,
//                 //         numberAmount,
//                 //         maxSolCost,
//                 //         tokenAmount - buyItems[0].initialTokenAmount
//                 //     );

//                 //     instructions = [...txBuyDev.instructions];
//                 //     zombieKeypairList = [signerKeypair, tokenAccount];
//                 //     instructionCount++;

//                 //     if (buyItems.length === 1) {
//                 //         /* Add Tip Instruction */
//                 //         let newInnerTransactions = [];
//                 //         newInnerTransactions.push(
//                 //             SystemProgram.transfer({
//                 //                 fromPubkey: accounts[buyItems[i].address].publicKey,
//                 //                 toPubkey: tipAccount,
//                 //                 lamports: LAMPORTS_PER_SOL * jitoTip,
//                 //             })
//                 //         )

//                 //         innerTxns.push({
//                 //             txns: newInnerTransactions,
//                 //             signers: [signerKeypair],
//                 //             payer: signerKeypair,
//                 //         });
//                 //     }
//                 // }
//                 else {
//                     //Buy Transaction
//                     const txBuyZombie = await buildMintBuyTx(
//                         program,
//                         connection,
//                         zombieKeypair,
//                         tokenMint.toString(),
//                         numberAmount,
//                         solAmount,
//                         tokenAmount,
//                         accounts[buyItems[0].address].publicKey
//                     );

//                     if (i === buyItems.length - 1) {
//                         /* Add Tip Instruction */
//                         let newInnerTransactions = [...txBuyZombie.instructions];
//                         newInnerTransactions.push(
//                             CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
//                         )

//                         // add to instructions
//                         instructions.push(...newInnerTransactions);
//                         zombieKeypairList.push(zombieKeypair);

//                         // add to innerTxns
//                         innerTxns.push({
//                             txns: [...instructions],
//                             signers: [...zombieKeypairList],
//                             payer: zombieKeypairList[0],
//                         });

//                         instructions = [];
//                         zombieKeypairList = [];
//                         instructionCount = 0;
//                     }
//                     else {

//                         // add to instructions
//                         instructions.push(...txBuyZombie.instructions);
//                         zombieKeypairList.push(zombieKeypair);
//                         instructionCount++;

//                         if (instructionCount >= process.env.INSTRUCTION_LIMIT) {
//                             innerTxns.push({
//                                 txns: [...instructions],
//                                 signers: [...zombieKeypairList],
//                                 payer: zombieKeypairList[0],
//                             });

//                             instructions = [];
//                             zombieKeypairList = [];
//                             instructionCount = 0;
//                         }
//                     }
//                 }
//             }

//             let extraInnerTxns = [];
//             instructions = []
//             zombieKeypairList = []
//             console.log("-------Extra Wallets", project.extraWallets)
//             for (let i = 0; i < project.extraWallets.length; i++) {
//                 const zombieKeypair = accounts[project.extraWallets[i].address];
//                 console.log(zombieKeypair)

//                 const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
//                 const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL - 0.02;
//                 const unitSlippage = 10 / 100;
//                 const numberAmount = maxSolCost / (1 + unitSlippage);
//                 const tokenAmount = project.extraWallets[i].sim.buy.tokenAmount;
//                 const solRequired = Number(project.extraWallets[i].sim.buy.solAmount) / LAMPORTS_PER_SOL;

//                 if (maxSolCost < solRequired) continue;

//                 const txBuyZombie = await buildMintBuyTx(
//                     program,
//                     connection,
//                     zombieKeypair,
//                     tokenMint.toString(),
//                     numberAmount,
//                     maxSolCost,
//                     tokenAmount,
//                     accounts[buyItems[0].address].publicKey
//                 );

//                 let newInnerTransactions = [...txBuyZombie.instructions];
//                 instructions.push(...newInnerTransactions);
//                 zombieKeypairList.push(zombieKeypair);
//             }

//             if (zombieKeypairList.length > 0) {
//                 extraInnerTxns.push({
//                     txns: [...instructions],
//                     signers: [...zombieKeypairList],
//                     payer: zombieKeypairList[0],
//                 });
//             }

//             let verTxns = [];

//             logToClients(myClients, "2. Submitting bundle transactions...", false);

//             console.log("Sending compressed trxs")

//             const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

//             for (let i = 0; i < innerTxns.length; i++) {
//                 verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...innerTxns[i].txns], recentBlockhash, [...innerTxns[i].signers], innerTxns[i].payer))
//             }

//             try {
//                 for (let i = 0; i < extraInnerTxns.length; i++) {
//                     verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...extraInnerTxns[i].txns], recentBlockhash, [...extraInnerTxns[i].signers], extraInnerTxns[i].payer))
//                 }
//             } catch (error) {
//                 console.log(error);
//             }

//             // verTxns.forEach(async tx => {
//             //     let sim = await connection.simulateTransaction(tx)
//             //     console.log("--------------- simulattion:\n", sim)
//             // });

//             let ret;
//             if (await buildTxOnNB(mintTx, signerKeypair, jitoTip)) {
//                 isMintSuccess = true;

//                 // Disable used PumpKeyPair
//                 const curPumpKeyPair = await PumpKeyPair.findOne({ publicKey: { $eq: tokenMint } });
//                 if (curPumpKeyPair && !curPumpKeyPair.isUsed) {
//                     curPumpKeyPair.isUsed = true;
//                     await curPumpKeyPair.save();
//                 }

//                 console.log("------ Mint Success! -------")
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: project }));

//                 return;

//                 ret = await buildBundleOnNB(verTxns);
//             }

//             if (!ret) {
//                 console.log("Failed to buy tokens!");
//                 for (let k = 0; k < myClients.length; k++)
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//                 return;
//             }

//             logToClients(myClients, "3. Transferring tokens...", false);

//             const wallets = project.wallets.filter(item => item.sim.enabled);
//             const mint = new PublicKey(project.token.address);

//             let xferItemsByFrom = {};
//             if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
//                 if (buyItems.length >= 2)
//                     xferItemsByFrom[buyItems[1].address] = [
//                         {
//                             from: buyItems[1].address,
//                             to: getTaxWallet(),
//                             tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
//                         }
//                     ]
//                 else
//                     xferItemsByFrom[buyItems[0].address] = [
//                         {
//                             from: buyItems[0].address,
//                             to: getTaxWallet(),
//                             tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
//                         }
//                     ]
//             }

//             // if (project.paymentId != 1) {
//             for (let i = 0; i < project.teamWallets.length; i++) {
//                 if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
//                     continue;

//                 const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.teamWallets[i].address].publicKey);

//                 let tokenBalance = null;
//                 try {
//                     const tokenAccountInfo = await getAccount(connection, associatedToken);
//                     tokenBalance = new BN(tokenAccountInfo.amount);
//                 }
//                 catch (err) {
//                     console.log(err);
//                 }

//                 if (!tokenBalance || tokenBalance.lt(new BN(project.teamWallets[i].sim.xfer.tokenAmount))) {
//                     if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
//                         xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
//                             ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
//                             {
//                                 from: project.teamWallets[i].sim.xfer.fromAddress,
//                                 to: project.teamWallets[i].address,
//                                 tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
//                             }
//                         ];
//                     }
//                     else {
//                         xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
//                             {
//                                 from: project.teamWallets[i].sim.xfer.fromAddress,
//                                 to: project.teamWallets[i].address,
//                                 tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
//                             }
//                         ];
//                     }
//                 }
//             }
//             // }

//             for (let i = 0; i < wallets.length; i++) {
//                 if (wallets[i].address === wallets[i].sim.xfer.fromAddress)
//                     continue;

//                 const associatedToken = getAssociatedTokenAddressSync(mint, accounts[wallets[i].address].publicKey);



//                 let tokenBalance = null;
//                 try {
//                     const tokenAccountInfo = await getAccount(connection, associatedToken);
//                     tokenBalance = new BN(tokenAccountInfo.amount);
//                 }
//                 catch (err) {
//                     console.log(err);
//                 }

//                 if (!tokenBalance || tokenBalance.lt(new BN(wallets[i].sim.xfer.tokenAmount))) {
//                     if (xferItemsByFrom[wallets[i].sim.xfer.fromAddress]) {
//                         xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
//                             ...xferItemsByFrom[wallets[i].sim.xfer.fromAddress],
//                             {
//                                 from: wallets[i].sim.xfer.fromAddress,
//                                 to: wallets[i].address,
//                                 tokenAmount: wallets[i].sim.xfer.tokenAmount,
//                             },
//                         ];
//                     }
//                     else {
//                         xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
//                             {
//                                 from: wallets[i].sim.xfer.fromAddress,
//                                 to: wallets[i].address,
//                                 tokenAmount: wallets[i].sim.xfer.tokenAmount,
//                             },
//                         ];
//                     }
//                 }
//             }

//             console.log("xferItemsByFrom: ", xferItemsByFrom)

//             let dispersed = true;
//             const USE_JITO = true;
//             if (USE_JITO) {
//                 let bundleItems = [];
//                 let bundleIndex = -1;
//                 for (let from in xferItemsByFrom) {
//                     const signers = [accounts[from]];
//                     let xferItems = xferItemsByFrom[from];
//                     let index = 0;
//                     while (index < xferItems.length) {
//                         let count = 0;
//                         let instructions = [];
//                         for (let i = index; i < xferItems.length; i++) {
//                             const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
//                             if (!fromTokenAccount)
//                                 continue;

//                             const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to));
//                             try {
//                                 const info = await connection.getAccountInfo(toTokenAccount);
//                                 if (!info) {
//                                     instructions.push(
//                                         createAssociatedTokenAccountInstruction(
//                                             accounts[from].publicKey,
//                                             toTokenAccount,
//                                             accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to),
//                                             mint
//                                         )
//                                     );
//                                 }
//                             }
//                             catch (err) {
//                                 console.log(err);
//                             }

//                             instructions.push(
//                                 createTransferInstruction(
//                                     fromTokenAccount,
//                                     toTokenAccount,
//                                     accounts[xferItems[i].from].publicKey,
//                                     xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
//                                 )
//                             );

//                             count++;
//                             if (count === 5)
//                                 break;
//                         }

//                         if (instructions.length > 0) {
//                             console.log("Transferring tokens...", from, index, index + count - 1);
//                             if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
//                                 bundleItems[bundleIndex].push({
//                                     instructions: instructions,
//                                     signers: signers,
//                                     payer: accounts[from].publicKey,
//                                 });
//                             }
//                             else {
//                                 bundleItems.push([
//                                     {
//                                         instructions: instructions,
//                                         signers: signers,
//                                         payer: accounts[from].publicKey,
//                                     }
//                                 ]);
//                                 bundleIndex++;
//                             }
//                         }
//                         else
//                             break;

//                         index += count;
//                     }
//                 }

//                 console.log("Bundle Items:", bundleItems.length);
//                 let bundleTxns = [];
//                 const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//                 for (let i = 0; i < bundleItems.length; i++) {
//                     let bundleItem = bundleItems[i];
//                     console.log("Bundle", i, bundleItem.length);
//                     let verTxns = [];
//                     for (let j = 0; j < bundleItem.length; j++) {
//                         if (j === bundleItem.length - 1) {
//                             bundleItem[j].instructions = [
//                                 CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
//                                 ...bundleItem[j].instructions
//                             ];
//                         }
//                         const transactionMessage = new TransactionMessage({
//                             payerKey: bundleItem[j].payer,
//                             instructions: bundleItem[j].instructions,
//                             recentBlockhash,
//                         });
//                         const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
//                         tx.sign(bundleItem[j].signers);
//                         verTxns.push(tx);
//                     }

//                     bundleTxns.push(verTxns);
//                 }

//                 const ret = await buildBundlesOnNB(bundleTxns);
//                 if (!ret) {
//                     console.log("Failed to transfer tokens");
//                     dispersed = false;
//                 }
//             }
//             else {
//                 let transactions = [];
//                 for (let from in xferItemsByFrom) {
//                     const signers = [accounts[from]];
//                     let xferItems = xferItemsByFrom[from];
//                     let index = 0;
//                     while (index < xferItems.length) {
//                         let count = 0;
//                         const tx = new Transaction();
//                         for (let i = index; i < xferItems.length; i++) {
//                             const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
//                             if (!fromTokenAccount)
//                                 continue;

//                             const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
//                             try {
//                                 const info = await connection.getAccountInfo(toTokenAccount);
//                                 if (!info) {
//                                     tx.add(
//                                         createAssociatedTokenAccountInstruction(
//                                             accounts[from].publicKey,
//                                             toTokenAccount,
//                                             accounts[xferItems[i].to].publicKey,
//                                             mint
//                                         )
//                                     );
//                                 }
//                             }
//                             catch (err) {
//                                 console.log(err);
//                             }

//                             tx.add(
//                                 createTransferInstruction(
//                                     fromTokenAccount,
//                                     toTokenAccount,
//                                     accounts[xferItems[i].from].publicKey,
//                                     xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
//                                 )
//                             );

//                             count++;
//                             if (count === 5)
//                                 break;
//                         }

//                         if (tx.instructions.length > 0) {
//                             console.log("Transferring tokens...", from, index, index + count - 1);
//                             transactions = [
//                                 ...transactions,
//                                 {
//                                     transaction: tx,
//                                     signers: signers,
//                                 }
//                             ];
//                         }
//                         else
//                             break;

//                         index += count;
//                     }
//                 }

//                 if (transactions.length > 0) {
//                     const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
//                     if (!ret) {
//                         console.log("Failed to transfer tokens");
//                         dispersed = false;
//                     }
//                 }
//             }

//             console.log("Success");
//             project.status = "TRADE";
//             await project.save();

//             const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
//             const mails = await Email.find();
//             let pendings = [];
//             for (let i = 0; i < mails.length; i++) {
//                 pendings = [
//                     ...pendings,
//                     sendEmail({
//                         to: mails[i].email,
//                         subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
//                         html: html
//                     }, async (err, data) => {
//                         if (err || data.startsWith("Error")) {
//                             console.log(err);
//                             return;
//                         }

//                         console.log('Mail sent successfully with data: ' + data);
//                     })
//                 ];
//             }

//             // startMetric(project._id.toString());
//             const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
//             for (let k = 0; k < myClients.length; k++) {
//                 if (myClients[k].user.role === "admin")
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
//                 else
//                     myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
//             }
//         }
//         catch (err) {
//             logToClients(myClients, err, true);
//             for (let k = 0; k < myClients.length; k++)
//                 myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
//         }
//     }
//     catch (err) {
//         console.log(err);
//         res.status(401).json({
//             success: false,
//             error: "Unknown error",
//         });
//     }
// }

exports.mintAndSnipePumpfunTokens = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Buying tokens...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            console.log("Zombie Wallet:", zombieWallet.publicKey.toString());

            let totalSolAmount = BigInt(0);

            // Calcaute sol amount to start Mint and Buy from Zombie to Dev wallet
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    totalSolAmount += BigInt(Math.round(Number(simulateData.wallets[i].sim.disperseAmount))); 
                }
            }
            console.log("Total Sol Amount:", Number(totalSolAmount) / LAMPORTS_PER_SOL);

            let accounts = {}; // match wallet pubkey to privateKey
            let walletTokenAccounts = {}; // match wallet pubkey to their all tokenAccounts 

            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (!accounts[simulateData.wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", simulateData.wallets[i].address);
                        continue;
                    }
                    accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            let buyItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "") {
                    // try {
                    //     walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
                    // }
                    // catch (err) {
                    //     console.log(err);
                    //     logToClients(myClients, err, true);
                    //     for (let k = 0; k < myClients.length; k++)
                    //         myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                    //     return;
                    // }

                    buyItems.push({
                        address: simulateData.wallets[i].address,
                        tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                        solAmount: simulateData.wallets[i].sim.buy.solAmount,
                    });
                }
            }

            console.log("walletTokenAccounts: ", walletTokenAccounts)
            console.log("Buy Items:", buyItems.length);


            logToClients(myClients, "1. Generating bundle transactions...", false);

            const signerKeypair = accounts[buyItems[0].address];

            const tokenMint = simulateData.token.address;
            const tokenName = project.token.name;
            const tokenSymbol = project.token.symbol;
            const tokenUri = project.token.tokenUri;

            const keyArray = JSON.parse(project.token.privateKey)
            const privkey = new Uint8Array(keyArray)
            const keypair = Keypair.fromSecretKey(privkey)
       
            const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))
            // Create an AnchorProvider instance
            const provider = new anchor.AnchorProvider(
                connection,
                new anchor.Wallet(signerKeypair),
                "confirmed"
            );

            // const pumpSDK = new PumpSdk(connection);

            const program = new anchor.Program(idl, provider);
            // const program = getPumpProgram(connection, new PublicKey(programID));

            // Create a Lookup Table
            let pumpPoolKeys = await getPumpPoolKeys(program, new PublicKey(tokenMint))
            let allPubKeys = [
                new PublicKey(programID),
                new PublicKey(MEMO_PROGRAM_ID),
                new PublicKey(feeRecipient),
                new PublicKey(EVENT_AUTH),
                NATIVE_MINT,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenAccount.publicKey,
                SYSVAR_RENT_PUBKEY,
                new PublicKey("ComputeBudget111111111111111111111111111111"),  // Compute Budget
                new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), // global state
                new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
                SystemProgram.programId
            ]
            allPubKeys = [...allPubKeys, ...pumpPoolKeys]

            for (let idx = 0; idx < buyItems.length; idx++) {
                const wallet = new PublicKey(buyItems[idx].address);
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    wallet
                );
                const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
                allPubKeys.push(wallet);
                allPubKeys.push(tokenAccount);
                allPubKeys.push(wrappedAccount);
            }

            // const firstAddressLookup = await createAddressLookupWithAddressList(
            //     connection,
            //     allPubKeys,
            //     zombieWallet
            // );

            // if (!firstAddressLookup) return null;
            const firstAddressLookup = new PublicKey("Ej3wFtgk3WywPnWPD3aychk38MqTdrjtqXkzbK8FpUih")

            const lookupTableAccounts = [];

            const startTime = Date.now();
            const TIMEOUT = 30000;
            let lookupTableAccount = null;

            // while (Date.now() - startTime < TIMEOUT) {
            //     console.log("---- verifing lookup Table", firstAddressLookup)
            lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

            //     if (lookupTableAccount.value && lookupTableAccount.value.state && lookupTableAccount.value.state.addresses.length >= allPubKeys.length) {
            //         console.log(`https://explorer.solana.com/address/${firstAddressLookup.toString()}/entries?cluster=mainnet`)
            //         break;
            //     }
            //     await sleep(1000)
            // }

            lookupTableAccounts.push(lookupTableAccount.value);

            if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                logToClients(myClients, "Failed to register Address Lookup.", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return false;
            }

            const bundleTxns = [];
            const firstBundle = [];

            const devKeypair = accounts[buyItems[0].address];
            const mint = new PublicKey(project.token.address);

            //-----------Mint and Buy Start------------------------------

            console.log("totalSolAmount", totalSolAmount.toString());
            const zombieToDevTransferTx = new Transaction();

            const zombieToDexTransferIx = SystemProgram.transfer({
                fromPubkey: zombieWallet.publicKey,
                toPubkey: devKeypair.publicKey,
                lamports: totalSolAmount,
            });

            zombieToDevTransferTx.add(zombieToDexTransferIx);

            firstBundle.push({
                instructions: zombieToDevTransferTx.instructions,   
                signers: [zombieWallet],
                payer: zombieWallet
            }); 

            // Mint and Dev Buy
            let devMaxSolCost = totalSolAmount - BigInt(30000000 + 2 * LAMPORTS_PER_SOL * jitoTip);
            const devTokenAmount = buyItems[0].tokenAmount;
            const mintAndBuyIxs = new Transaction();

            // Create Mint Instruction
            const createMintIx = await buildMintTx(
                program,
                devKeypair,
                new PublicKey(tokenMint),
                tokenName,
                tokenSymbol,
                tokenUri
            );

            // Create Buy Instruction
            const createBuyDevIx = await buildMintBuyTxBuffer(
                devKeypair,
                new PublicKey(tokenMint),
                devMaxSolCost,
                devTokenAmount,
                devKeypair.publicKey
            );

            const priorityFeeIxs = getPriorifyFeeIxs({
                unitLimit: 300000,
                unitPrice: 100000
            });

            mintAndBuyIxs.add(priorityFeeIxs, createMintIx, createBuyDevIx);

            firstBundle.push({
                instructions: mintAndBuyIxs.instructions,
                signers: [tokenAccount, devKeypair],
                payer: devKeypair,
            });

            // Create JitoTip Transaction
            // const jitoTipTx = new Transaction();
            // const jitoTipIx = CreateJitoTipInstruction(zombieWallet.publicKey, LAMPORTS_PER_SOL * jitoTip);
            // jitoTipTx.add(jitoTipIx);

            const astralaneTipTx = new Transaction();
            const astralaneTipIx = CreateTraderAPITipInstruction(zombieWallet.publicKey, LAMPORTS_PER_SOL * jitoTip);
            astralaneTipTx.add(astralaneTipIx);

            firstBundle.push({
                instructions: astralaneTipTx.instructions,   
                signers: [zombieWallet],
                payer: zombieWallet
            }); 
            
            // Insert firstBundle to bundleLists
            bundleTxns.push(firstBundle);

            //-----------Mint and Buy finished-----------------------

            
            for (let i = 1; i < buyItems.length; i+=2) {
                const bundle = [];
                for (let j = i; j < i + 2 && j < buyItems.length; j++) {
                    const buyerKeypair = accounts[buyItems[j].address];
                    const buyerMaxSolCost = buyItems[j].solAmount;
                    const buyerTokenAmount = buyItems[j].tokenAmount;
                    
                    const devSellTx = new Transaction();
                    const sniperBuyTx = new Transaction();
                    
                    const priorityUnitPrice = getPriorityUnitPrice();
                    const priorityFeeIxs = getPriorifyFeeIxs({
                        unitLimit: 150000,
                        unitPrice: priorityUnitPrice
                    });
                    
                    const initializeDevIx = await buildInitializeTx(devKeypair.publicKey, buyerKeypair.publicKey);
                    // dev sell
                    const createSellDevIx = await buildSellTxBuffer(
                        devKeypair,
                        new PublicKey(tokenMint),
                        0,
                        buyerTokenAmount,
                        devKeypair.publicKey,
                        false
                    );

                    const feeAmountFrom = Math.floor(8000000 + jitoTip * LAMPORTS_PER_SOL);
                    const feeAmountTo = Math.floor(2000000 + jitoTip * LAMPORTS_PER_SOL);

                    // transfer sol from dev to buyer
                    const recoverIx = await buildRecoverTx(
                        devKeypair.publicKey,
                        buyerKeypair.publicKey,
                        feeAmountFrom
                    );

                    // sniper buy using contract
                    const createBuySniperContractIx = await buildBuyTxBufferContract(
                        buyerKeypair,
                        new PublicKey(tokenMint),
                        buyerTokenAmount,
                        devKeypair.publicKey,
                        feeAmountTo
                    );

                    devSellTx.add(priorityFeeIxs, initializeDevIx, createSellDevIx, recoverIx);

                    bundle.push({
                        instructions: devSellTx.instructions,   
                        signers: [devKeypair],
                        payer: devKeypair
                    });
                    
                    sniperBuyTx.add(priorityFeeIxs, createBuySniperContractIx);
                    if (j == i+1 || j == buyItems.length-1) {
                        const tipForSnipeIx = CreateTraderAPITipInstruction(buyerKeypair.publicKey, LAMPORTS_PER_SOL * jitoTip);
                        sniperBuyTx.add(tipForSnipeIx);
                    }

                    bundle.push({
                        instructions: sniperBuyTx.instructions,   
                        signers: [buyerKeypair],
                        payer: buyerKeypair
                    });

                }

                bundleTxns.push(bundle);
            }

            logToClients(myClients, "2. Submitting bundle transactions...", false);

            console.log("Sending compressed trxs");

            let latestBlockhash;
            try {
                latestBlockhash = await connection.getLatestBlockhash("confirmed");
            } catch (error) {}

            // start interval to get latestBlockhash each 5 seconds
            const recentBlockhashInterval = setInterval(async () => {
                try {
                    latestBlockhash = await connection.getLatestBlockhash("confirmed");
                } catch (error) {}
            }, 1000);

            const signatures = [];

            for (let i = 0; i < bundleTxns.length; i++) {
                const versionedTxs = [];
                const bundle = bundleTxns[i];
                for (const txItem of bundle) {
                    versionedTxs.push(makeVerTxWithLUT(lookupTableAccounts[0], txItem.instructions, latestBlockhash.blockhash, txItem.signers, txItem.payer));
                }

                signatures.push(bs58.encode(versionedTxs[0].signatures[0]));

                const simulateMode = getSimulateMode();
                if (simulateMode) {
                    const simulateResult = await simulateTxs(connection, versionedTxs);
                    // const simulateResult = await simulateBundle(versionedTxs);
                    console.log("signature", bs58.encode(versionedTxs[0].signatures[0]), "result", simulateResult);
                    
                    // try {
                    //     const signature = await connection.sendRawTransaction(
                    //         versionedTxs[0].serialize(),
                    //         {
                    //             preflightCommitment: "confirmed",
                    //             skipPreflight: false,
                    //             maxRetries: 0,
                    //         }
                    //     );
                    //     console.log(signature);
                    // } catch (error) {
                    //     console.log(error);
                    // }
                    // const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                    // for (let k = 0; k < myClients.length; k++) {
                    //     if (myClients[k].user.role === "admin")
                    //         myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                    //     else
                    //         myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                    // }
                    // return;
                }

                if (i == 0) {
                    const result = await buildBundleOnNBAndConfirmTxId(connection, versionedTxs, "confirmed");
                    if (result) {
                        const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                            else
                                myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
                        }
                    } else {
                        console.log("Failed to buy tokens!");
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                } else {
                    await buildBundleOnNB(versionedTxs);
                }
                await sleep(300);
            }

            clearInterval(recentBlockhashInterval); 
            
            let count = 0;
            let isMinted = true;
            const pollResults = await pollTransactionStatuses(connection, signatures, 30, 2000);
            const successCounts = signatures.map((signature, index) => {
                const result = pollResults.get(signature);
                console.log(`index: ${index + 1}, signature: ${signature}, result: ${result}`);
                
                if (result && !result.err) {
                    count++;
                    return true;
                } else {
                    return false;
                }
            });
              

            isMinted = successCounts[0];
            console.log("count:", count, "isMinted:", isMinted);

            if (count < bundleTxns.length) {
                let count = 0;
                if (isMinted) {
                    const falseIndexes = successCounts.map((value, index) => (value === false ? index : -1)).filter(index => index !== -1);
                    
                    for (const index of falseIndexes) {
                        const bundle = bundleTxns[index];
                        const versionedTxs = [];

                        let latestBlockhash;
                        let i = 0;
                        for (i = 0; i < 2; i++){
                            try {
                                latestBlockhash = await connection.getLatestBlockhash("confirmed");
                                break;
                            } catch (error) {}
                        }

                        if (i < 2) {
                            for (const txItem of bundle) {
                                versionedTxs.push(makeVerTxWithLUT(lookupTableAccounts[0], txItem.instructions, latestBlockhash.blockhash, txItem.signers, txItem.payer));
                            }
                            

                            signatures.push(bs58.encode(versionedTxs[0].signatures[0]));

                            const simulateMode = getSimulateMode();
                            if (simulateMode) {
                                const simulateResult = await simulateTxs(connection, versionedTxs);
                                console.log("signature", bs58.encode(versionedTxs[0].signatures[0]), "result", simulateResult);
                            }
                          
                            // try {
                            //     const signature = await connection.sendRawTransaction(
                            //         versionedTxs[0].serialize(),
                            //         {
                            //             preflightCommitment: "confirmed",
                            //             skipPreflight: true,
                            //             maxRetries: 0,
                            //         }
                            //     );
                            //     console.log(signature);
                            // } catch (error) {
                            //     console.log(error);
                            // }

                            // const result = await buildBundleOnNBAndConfirmTxId(connection, versionedTxs, "confirmed");
                            // if (result) {
                            //     count++;
                            // }
                            await sleep(300);
                        }
                    }

                    // if (count < falseIndexes.length) {
                    //     console.log("Failed to buy tokens!");
                    //     for (let k = 0; k < myClients.length; k++)
                    //         myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    //     return;
                    // }
                } else {
                    console.log("Failed to buy tokens!");
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }

          
            logToClients(myClients, "3. Transferring tokens...", false);

            let taxSuccess = true;
            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                let xferItemByFrom;
                const taxWallet = new PublicKey(getTaxWallet());
                if (buyItems.length >= 2)
                    xferItemByFrom = 
                        {
                            from: buyItems[1].address,
                            to: taxWallet,
                            tokenAmount: 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100
                        }
                    
                else
                    xferItemByFrom = 
                        {
                            from: buyItems[0].address,
                            to: taxWallet,
                            tokenAmount: 1000000000 * PAYMENT_OPTIONS[project.paymentId].token / 100
                        }
                
                let i = 0;
                for (i = 0; i < 5; i++) {
                    const tx = new Transaction();
                    const buyerKeypair = accounts[xferItemByFrom.from];
                    const tokenAmount = BigInt(Math.floor(xferItemByFrom.tokenAmount * Math.pow(10, Number(project.token.decimals))));

                    const fromUserAta = getAssociatedTokenAddressSync(mint, buyerKeypair.publicKey, true);
                    const toUserAta = getAssociatedTokenAddressSync(mint, taxWallet, true);
                            
                    const priorityFeeIxs = getPriorifyFeeIxs({
                        unitLimit: 150000,
                        unitPrice: 100000
                    });

                    tx.add(priorityFeeIxs);

                    try {
                        await getAccount(connection, toUserAta, "confirmed");
                    } catch (error) {
                        tx.add(
                            createAssociatedTokenAccountInstruction(
                                buyerKeypair.publicKey,
                                toUserAta,
                                taxWallet,
                                mint
                            )
                        );
                    }

                    tx.add(
                        createTransferInstruction(
                            fromUserAta,
                            toUserAta,
                            buyerKeypair.publicKey,
                            tokenAmount
                        )
                    );

                    const astralaneTipIx = CreateTraderAPITipInstruction(buyerKeypair.publicKey, LAMPORTS_PER_SOL * jitoTip);
                    tx.add(astralaneTipIx);

                    let latestBlockhash 
                    while (true) {
                        try {
                            latestBlockhash = await connection.getLatestBlockhash("confirmed");
                            break;
                        } catch (error) {
                            await sleep(500);
                        }
                    }

                    const versionedTx = makeVerTx(tx.instructions, latestBlockhash.blockhash, [buyerKeypair], buyerKeypair);

                    const result = await buildBundleOnNBAndConfirmTxId(connection, [versionedTx], "confirmed")
                    if (result) break;

                    await sleep(2000);
                }   
                if (i == 5) taxSuccess = false;
            }

            console.log("Success");
            project.status = "TRADE";
            await project.save();

            const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
            const mails = await Email.find();
            let pendings = [];
            for (let i = 0; i < mails.length; i++) {
                pendings = [
                    ...pendings,
                    sendEmail({
                        to: mails[i].email,
                        subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
                        html: html
                    }, async (err, data) => {
                        if (err || data.startsWith("Error")) {
                            console.log(err);
                            return;
                        }

                        console.log('Mail sent successfully with data: ' + data);
                    })
                ];
            }

            // startMetric(project._id.toString());
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("MINT_SNIPE_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.mintAndBuyPumpfunTokens = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Mint & Buying tokens...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            
            const { connection } = useConnection();
            
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);
            
            const zombieWallet = await getZombieWallet(project);
            if (!zombieWallet) {
                logToClients(myClients, "ERROR: Zombie wallet not set", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            console.log("Zombie Wallet:", zombieWallet.publicKey.toString());

            let totalSolAmount = BigInt(0);

            // Calcaute sol amount to start Mint and Buy from Zombie to Dev wallet
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.disperseAmount !== "" && simulateData.wallets[i].sim.disperseAmount !== "0") {
                    totalSolAmount += BigInt(Math.round(Number(simulateData.wallets[i].sim.disperseAmount))); 
                }
            }
            console.log("Total Sol Amount:", Number(totalSolAmount) / LAMPORTS_PER_SOL);

            let accounts = {}; // match wallet pubkey to privateKey
            let walletTokenAccounts = {}; // match wallet pubkey to their all tokenAccounts 

            // match wallet pubkey to privateKey
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (!accounts[simulateData.wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", simulateData.wallets[i].address);
                        continue;
                    }
                    accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }


            let buyItems = [];
            // 
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "" && simulateData.wallets[i].sim.buy.tokenAmount !== "0") {
                    try {
                        walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    if (buyItems.length == 0) {
                        buyItems.push({
                            address: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                            initialTokenAmount: simulateData.wallets[i].initialTokenAmount,
                            solAmount: simulateData.wallets[i].sim.buy.solAmount,
                        });
                    } else {
                        buyItems.push({
                            address: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                            solAmount: simulateData.wallets[i].sim.buy.solAmount,
                        });
                    }
                }
            }

            console.log("accounts: ", accounts)
            console.log("walletTokenAccounts: ", walletTokenAccounts)
            console.log("Buy Items:", buyItems.length);


            logToClients(myClients, "1. Generating bundle transactions...", false);

            const signerKeypair = accounts[buyItems[0].address]; // mintor and dev

            const tokenMint = simulateData.token.address;
            const tokenName = project.token.name;
            const tokenSymbol = project.token.symbol;
            const tokenUri = project.token.tokenUri;

            const keyArray = JSON.parse(project.token.privateKey)
            const privkey = new Uint8Array(keyArray)
            const keypair = Keypair.fromSecretKey(privkey) // token mint keypair

            const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))

            const program = getPumpProgram(connection, new PublicKey(programID));



            // for (let i = 0; i < buyItems.length; i++) {
            //     const buyerWalletKeypair = accounts[buyItems[i].address];
            //     const tokenAmount = buyItems[i].tokenAmount;
            //     const solAmount = buyItems[i].solAmount;



            //     if (i === 0) {
            //         // Mint Transaction
            //         const txMint = await buildMintTx(
            //             program,
            //             zombieKeypair,
            //             new PublicKey(tokenMint),
            //             tokenName,
            //             tokenSymbol,
            //             tokenUri
            //         );

            //         //Buy Transaction
            //         const txBuyDev = await buildMintBuyTx(
            //             program,
            //             connection,
            //             zombieKeypair,
            //             tokenMint,
            //             numberAmount,
            //             maxSolCost,
            //             tokenAmount,
            //             zombieKeypair.publicKey
            //         );

            //         instructions = [...txMint.instructions, ...txBuyDev.instructions];
            //         zombieKeypairList = [signerKeypair, tokenAccount];
            //         instructionCount += 3;

            //         if (buyItems.length === 1) {
            //             /* Add Tip Instruction */
            //             let newInnerTransactions = [];
            //             newInnerTransactions.push(
            //                 CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
            //             )

            //             instructions.push(...newInnerTransactions);

            //             innerTxns.push({
            //                 txns: [...instructions],
            //                 signers: [...zombieKeypairList],
            //                 payer: signerKeypair,
            //             });
            //         }
            //     }
            //     else {
            //         //Buy Transaction
            //         const txBuyZombie = await buildMintBuyTx(
            //             program,
            //             connection,
            //             zombieKeypair,
            //             tokenMint.toString(),
            //             numberAmount,
            //             maxSolCost,
            //             tokenAmount,
            //             accounts[buyItems[0].address].publicKey,
            //         );

            //         if (i === buyItems.length - 1) {
            //             /* Add Tip Instruction */
            //             let newInnerTransactions = [...txBuyZombie.instructions];
            //             // newInnerTransactions.push(
            //             //     CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
            //             // )

            //             // add to instructions
            //             instructions.push(...newInnerTransactions);
            //             zombieKeypairList.push(zombieKeypair);

            //             // add to innerTxns
            //             innerTxns.push({
            //                 txns: [
            //                     CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip),
            //                     ...instructions
            //                 ],
            //                 signers: [...zombieKeypairList],
            //                 payer: zombieKeypairList[0],
            //             });

            //             instructions = [];
            //             zombieKeypairList = [];
            //             instructionCount = 0;
            //         }
            //         else {

            //             // add to instructions
            //             instructions.push(...txBuyZombie.instructions);
            //             zombieKeypairList.push(zombieKeypair);
            //             instructionCount++;

            //             if (instructionCount >= process.env.INSTRUCTION_LIMIT) {
            //                 console.log("instructionCount", instructionCount)
            //                 innerTxns.push({
            //                     txns: [...instructions],
            //                     signers: [...zombieKeypairList],
            //                     payer: zombieKeypairList[0],
            //                 });

            //                 instructions = [];
            //                 zombieKeypairList = [];
            //                 instructionCount = 0;
            //             }
            //         }
            //     }
            // }

            
            // // Jito Configuration
            // let mintTx;

            // let innerTxns = [];
            // let instructions = [];
            // let zombieKeypairList = [];
            // let instructionCount = 0;

            // for (let i = 0; i < buyItems.length; i++) {
            //     const zombieKeypair = accounts[buyItems[i].address];

            //     const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
            //     const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL;
            //     const unitSlippage = 10 / 100;
            //     const numberAmount = maxSolCost / (1 + unitSlippage);
            //     const tokenAmount = buyItems[i].tokenAmount;
            //     const solAmount = Math.ceil(Number(buyItems[i].solAmount) * 100 / 99) / LAMPORTS_PER_SOL;

            //     if (i == 0) {
            //         const token_metadata = {
            //             'name': tokenName,
            //             'symbol': tokenSymbol,
            //             'uri': tokenUri
            //         }

            //         const response = await fetch("https://pumpportal.fun/api/trade-local", {
            //             method: "POST",
            //             headers: {
            //                 "Content-Type": "application/json",
            //             },
            //             body: JSON.stringify({
            //                 'publicKey': signerKeypair.publicKey.toString(),
            //                 'action': 'create',
            //                 'tokenMetadata': token_metadata,
            //                 'mint': tokenAccount.publicKey.toString(),
            //                 'denominatedInSol': 'false',
            //                 'amount': tokenAmount,
            //                 'slippage': 10,
            //                 'priorityFee': 0.0005,
            //                 'pool': 'pump'
            //             }),
            //         })

            //         const data = await response.arrayBuffer();
            //         mintTx = VersionedTransaction.deserialize(new Uint8Array(data));
            //         mintTx.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
            //         mintTx.sign([signerKeypair, tokenAccount])
            //     }

            //     // if (i === 0) {
            //     //     if (tokenAmount - buyItems[0].initialTokenAmount == 0) continue;

            //     //     const txBuyDev = await buildMintBuyTx(
            //     //         program,
            //     //         signerKeypair,
            //     //         tokenMint,
            //     //         numberAmount,
            //     //         maxSolCost,
            //     //         tokenAmount - buyItems[0].initialTokenAmount
            //     //     );

            //     //     instructions = [...txBuyDev.instructions];
            //     //     zombieKeypairList = [signerKeypair, tokenAccount];
            //     //     instructionCount++;

            //     //     if (buyItems.length === 1) {
            //     //         /* Add Tip Instruction */
            //     //         let newInnerTransactions = [];
            //     //         newInnerTransactions.push(
            //     //             SystemProgram.transfer({
            //     //                 fromPubkey: accounts[buyItems[i].address].publicKey,
            //     //                 toPubkey: tipAccount,
            //     //                 lamports: LAMPORTS_PER_SOL * jitoTip,
            //     //             })
            //     //         )

            //     //         innerTxns.push({
            //     //             txns: newInnerTransactions,
            //     //             signers: [signerKeypair],
            //     //             payer: signerKeypair,
            //     //         });
            //     //     }
            //     // }
            //     else {
            //         //Buy Transaction
            //         const txBuyZombie = await buildMintBuyTx(
            //             program,
            //             connection,
            //             zombieKeypair,
            //             tokenMint.toString(),
            //             numberAmount,
            //             solAmount,
            //             tokenAmount,
            //             accounts[buyItems[0].address].publicKey
            //         );

            //         if (i === buyItems.length - 1) {
            //             /* Add Tip Instruction */
            //             let newInnerTransactions = [...txBuyZombie.instructions];
            //             newInnerTransactions.push(
            //                 CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
            //             )

            //             // add to instructions
            //             instructions.push(...newInnerTransactions);
            //             zombieKeypairList.push(zombieKeypair);

            //             // add to innerTxns
            //             innerTxns.push({
            //                 txns: [...instructions],
            //                 signers: [...zombieKeypairList],
            //                 payer: zombieKeypairList[0],
            //             });

            //             instructions = [];
            //             zombieKeypairList = [];
            //             instructionCount = 0;
            //         }
            //         else {

            //             // add to instructions
            //             instructions.push(...txBuyZombie.instructions);
            //             zombieKeypairList.push(zombieKeypair);
            //             instructionCount++;

            //             if (instructionCount >= process.env.INSTRUCTION_LIMIT) {
            //                 innerTxns.push({
            //                     txns: [...instructions],
            //                     signers: [...zombieKeypairList],
            //                     payer: zombieKeypairList[0],
            //                 });

            //                 instructions = [];
            //                 zombieKeypairList = [];
            //                 instructionCount = 0;
            //             }
            //         }
            //     }
            // }

            // let extraInnerTxns = [];
            // instructions = []
            // zombieKeypairList = []
            // console.log("-------Extra Wallets", project.extraWallets)
            // // for (let i = 0; i < project.extraWallets.length; i++) {
            // //     const zombieKeypair = accounts[project.extraWallets[i].address];
            // //     console.log(zombieKeypair)

            // //     const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
            // //     const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL - 0.02;
            // //     const unitSlippage = 10 / 100;
            // //     const numberAmount = maxSolCost / (1 + unitSlippage);
            // //     const tokenAmount = project.extraWallets[i].sim.buy.tokenAmount;
            // //     const solRequired = Number(project.extraWallets[i].sim.buy.solAmount) / LAMPORTS_PER_SOL;

            // //     if (maxSolCost < solRequired) continue;

            // //     const txBuyZombie = await buildMintBuyTx(
            // //         program,
            // //         connection,
            // //         zombieKeypair,
            // //         tokenMint.toString(),
            // //         numberAmount,
            // //         maxSolCost,
            // //         tokenAmount,
            // //         accounts[buyItems[0].address].publicKey
            // //     );

            // //     let newInnerTransactions = [...txBuyZombie.instructions];
            // //     instructions.push(...newInnerTransactions);
            // //     zombieKeypairList.push(zombieKeypair);
            // // }

            // if (zombieKeypairList.length > 0) {
            //     extraInnerTxns.push({
            //         txns: [...instructions],
            //         signers: [...zombieKeypairList],
            //         payer: zombieKeypairList[0],
            //     });
            // }

            // let verTxns = [];

            // logToClients(myClients, "2. Submitting bundle transactions...", false);

            // console.log("Sending compressed trxs")

            // const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            // for (let i = 0; i < innerTxns.length; i++) {
            //     verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...innerTxns[i].txns], recentBlockhash, [...innerTxns[i].signers], innerTxns[i].payer))
            // }

            // try {
            //     for (let i = 0; i < extraInnerTxns.length; i++) {
            //         verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...extraInnerTxns[i].txns], recentBlockhash, [...extraInnerTxns[i].signers], extraInnerTxns[i].payer))
            //     }
            // } catch (error) {
            //     console.log(error);
            // }

            // // verTxns.forEach(async tx => {
            // //     let sim = await connection.simulateTransaction(tx)
            // //     console.log("--------------- simulattion:\n", sim)
            // // });

            // let ret;
            // if (await buildTxOnNB(mintTx, signerKeypair, jitoTip)) {
            //     isMintSuccess = true;

            //     // Disable used PumpKeyPair
            //     const curPumpKeyPair = await PumpKeyPair.findOne({ publicKey: { $eq: tokenMint } });
            //     if (curPumpKeyPair && !curPumpKeyPair.isUsed) {
            //         curPumpKeyPair.isUsed = true;
            //         await curPumpKeyPair.save();
            //     }

            //     console.log("------ Mint Success! -------")
            //     for (let k = 0; k < myClients.length; k++)
            //         myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: project }));

            //     return;

            //     ret = await buildBundleOnNB(verTxns);
            // }

            // if (!ret) {
            //     console.log("Failed to buy tokens!");
            //     for (let k = 0; k < myClients.length; k++)
            //         myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
            //     return;
            // }

            // logToClients(myClients, "3. Transferring tokens...", false);

            // const wallets = project.wallets.filter(item => item.sim.enabled);
            // const mint = new PublicKey(project.token.address);

            // let xferItemsByFrom = {};
            // if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
            //     if (buyItems.length >= 2)
            //         xferItemsByFrom[buyItems[1].address] = [
            //             {
            //                 from: buyItems[1].address,
            //                 to: getTaxWallet(),
            //                 tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
            //             }
            //         ]
            //     else
            //         xferItemsByFrom[buyItems[0].address] = [
            //             {
            //                 from: buyItems[0].address,
            //                 to: getTaxWallet(),
            //                 tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
            //             }
            //         ]
            // }

            // // if (project.paymentId != 1) {
            // // for (let i = 0; i < project.teamWallets.length; i++) {
            // //     if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
            // //         continue;

            // //     const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.teamWallets[i].address].publicKey);

            // //     let tokenBalance = null;
            // //     try {
            // //         const tokenAccountInfo = await getAccount(connection, associatedToken);
            // //         tokenBalance = new BN(tokenAccountInfo.amount);
            // //     }
            // //     catch (err) {
            // //         console.log(err);
            // //     }

            // //     if (!tokenBalance || tokenBalance.lt(new BN(project.teamWallets[i].sim.xfer.tokenAmount))) {
            // //         if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
            // //             xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
            // //                 ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
            // //                 {
            // //                     from: project.teamWallets[i].sim.xfer.fromAddress,
            // //                     to: project.teamWallets[i].address,
            // //                     tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
            // //                 }
            // //             ];
            // //         }
            // //         else {
            // //             xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
            // //                 {
            // //                     from: project.teamWallets[i].sim.xfer.fromAddress,
            // //                     to: project.teamWallets[i].address,
            // //                     tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
            // //                 }
            // //             ];
            // //         }
            // //     }
            // // }
            // // }

            // for (let i = 0; i < wallets.length; i++) {
            //     if (wallets[i].address === wallets[i].sim.xfer.fromAddress)
            //         continue;

            //     const associatedToken = getAssociatedTokenAddressSync(mint, accounts[wallets[i].address].publicKey);



            //     let tokenBalance = null;
            //     try {
            //         const tokenAccountInfo = await getAccount(connection, associatedToken);
            //         tokenBalance = new BN(tokenAccountInfo.amount);
            //     }
            //     catch (err) {
            //         console.log(err);
            //     }

            //     if (!tokenBalance || tokenBalance.lt(new BN(wallets[i].sim.xfer.tokenAmount))) {
            //         if (xferItemsByFrom[wallets[i].sim.xfer.fromAddress]) {
            //             xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
            //                 ...xferItemsByFrom[wallets[i].sim.xfer.fromAddress],
            //                 {
            //                     from: wallets[i].sim.xfer.fromAddress,
            //                     to: wallets[i].address,
            //                     tokenAmount: wallets[i].sim.xfer.tokenAmount,
            //                 },
            //             ];
            //         }
            //         else {
            //             xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
            //                 {
            //                     from: wallets[i].sim.xfer.fromAddress,
            //                     to: wallets[i].address,
            //                     tokenAmount: wallets[i].sim.xfer.tokenAmount,
            //                 },
            //             ];
            //         }
            //     }
            // }

            // console.log("xferItemsByFrom: ", xferItemsByFrom)

            // let dispersed = true;
            // const USE_JITO = true;
            // if (USE_JITO) {
            //     let bundleItems = [];
            //     let bundleIndex = -1;
            //     for (let from in xferItemsByFrom) {
            //         const signers = [accounts[from]];
            //         let xferItems = xferItemsByFrom[from];
            //         let index = 0;
            //         while (index < xferItems.length) {
            //             let count = 0;
            //             let instructions = [];
            //             for (let i = index; i < xferItems.length; i++) {
            //                 const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
            //                 if (!fromTokenAccount)
            //                     continue;

            //                 const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to));
            //                 try {
            //                     const info = await connection.getAccountInfo(toTokenAccount);
            //                     if (!info) {
            //                         instructions.push(
            //                             createAssociatedTokenAccountInstruction(
            //                                 accounts[from].publicKey,
            //                                 toTokenAccount,
            //                                 accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to),
            //                                 mint
            //                             )
            //                         );
            //                     }
            //                 }
            //                 catch (err) {
            //                     console.log(err);
            //                 }

            //                 instructions.push(
            //                     createTransferInstruction(
            //                         fromTokenAccount,
            //                         toTokenAccount,
            //                         accounts[xferItems[i].from].publicKey,
            //                         xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
            //                     )
            //                 );

            //                 count++;
            //                 if (count === 5)
            //                     break;
            //             }

            //             if (instructions.length > 0) {
            //                 console.log("Transferring tokens...", from, index, index + count - 1);
            //                 if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
            //                     bundleItems[bundleIndex].push({
            //                         instructions: instructions,
            //                         signers: signers,
            //                         payer: accounts[from].publicKey,
            //                     });
            //                 }
            //                 else {
            //                     bundleItems.push([
            //                         {
            //                             instructions: instructions,
            //                             signers: signers,
            //                             payer: accounts[from].publicKey,
            //                         }
            //                     ]);
            //                     bundleIndex++;
            //                 }
            //             }
            //             else
            //                 break;

            //             index += count;
            //         }
            //     }

            //     console.log("Bundle Items:", bundleItems.length);
            //     let bundleTxns = [];
            //     const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            //     for (let i = 0; i < bundleItems.length; i++) {
            //         let bundleItem = bundleItems[i];
            //         console.log("Bundle", i, bundleItem.length);
            //         let verTxns = [];
            //         for (let j = 0; j < bundleItem.length; j++) {
            //             if (j === bundleItem.length - 1) {
            //                 bundleItem[j].instructions = [
            //                     CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
            //                     ...bundleItem[j].instructions
            //                 ];
            //             }
            //             const transactionMessage = new TransactionMessage({
            //                 payerKey: bundleItem[j].payer,
            //                 instructions: bundleItem[j].instructions,
            //                 recentBlockhash,
            //             });
            //             const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
            //             tx.sign(bundleItem[j].signers);
            //             verTxns.push(tx);
            //         }

            //         bundleTxns.push(verTxns);
            //     }

            //     const ret = await buildBundlesOnNB(bundleTxns);
            //     if (!ret) {
            //         console.log("Failed to transfer tokens");
            //         dispersed = false;
            //     }
            // }
            // else {
            //     let transactions = [];
            //     for (let from in xferItemsByFrom) {
            //         const signers = [accounts[from]];
            //         let xferItems = xferItemsByFrom[from];
            //         let index = 0;
            //         while (index < xferItems.length) {
            //             let count = 0;
            //             const tx = new Transaction();
            //             for (let i = index; i < xferItems.length; i++) {
            //                 const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
            //                 if (!fromTokenAccount)
            //                     continue;

            //                 const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
            //                 try {
            //                     const info = await connection.getAccountInfo(toTokenAccount);
            //                     if (!info) {
            //                         tx.add(
            //                             createAssociatedTokenAccountInstruction(
            //                                 accounts[from].publicKey,
            //                                 toTokenAccount,
            //                                 accounts[xferItems[i].to].publicKey,
            //                                 mint
            //                             )
            //                         );
            //                     }
            //                 }
            //                 catch (err) {
            //                     console.log(err);
            //                 }

            //                 tx.add(
            //                     createTransferInstruction(
            //                         fromTokenAccount,
            //                         toTokenAccount,
            //                         accounts[xferItems[i].from].publicKey,
            //                         xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
            //                     )
            //                 );

            //                 count++;
            //                 if (count === 5)
            //                     break;
            //             }

            //             if (tx.instructions.length > 0) {
            //                 console.log("Transferring tokens...", from, index, index + count - 1);
            //                 transactions = [
            //                     ...transactions,
            //                     {
            //                         transaction: tx,
            //                         signers: signers,
            //                     }
            //                 ];
            //             }
            //             else
            //                 break;

            //             index += count;
            //         }
            //     }

            //     if (transactions.length > 0) {
            //         const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
            //         if (!ret) {
            //             console.log("Failed to transfer tokens");
            //             dispersed = false;
            //         }
            //     }
            // }

            console.log("Success");
            project.status = "TRADE";
            await project.save();

            const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
            const mails = await Email.find();
            let pendings = [];
            for (let i = 0; i < mails.length; i++) {
                pendings = [
                    ...pendings,
                    sendEmail({
                        to: mails[i].email,
                        subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
                        html: html
                    }, async (err, data) => {
                        if (err || data.startsWith("Error")) {
                            console.log(err);
                            return;
                        }

                        console.log('Mail sent successfully with data: ' + data);
                    })
                ];
            }

            // startMetric(project._id.toString());
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.mintPumpfunToken = async (req, res) => {
    const { simulateData } = req.body;
    console.log("Buying tokens...", simulateData);
    try {
        const project = await Project.findById(simulateData.projectId);
        if (req.user.role === "admin" || project.userId !== req.user._id.toString() || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            let account;
            let walletTokenAccount;

            let buyItem;
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "") {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));

                    try {
                        walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    buyItem = {
                        address: simulateData.wallets[i].address,
                        tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                        initialTokenAmount: simulateData.wallets[i].initialTokenAmount,
                        solAmount: simulateData.wallets[i].sim.buy.solAmount,
                    };
                    break;
                }
            }

            console.log("accounts: ", account)
            console.log("walletTokenAccounts: ", walletTokenAccount)


            logToClients(myClients, "1. Generating bundle transactions...", false);

            const signerKeypair = account;

            const tokenMint = simulateData.token.address;
            const tokenName = project.token.name;
            const tokenSymbol = project.token.symbol;
            const tokenUri = project.token.tokenUri;

            const keyArray = JSON.parse(project.token.privateKey)
            const privkey = new Uint8Array(keyArray)
            const keypair = Keypair.fromSecretKey(privkey)

            const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))

            // Create an AnchorProvider instance
            const provider = new anchor.AnchorProvider(
                connection,
                new anchor.Wallet(signerKeypair),
                anchor.AnchorProvider.defaultOptions()
            );

            // const program = new anchor.Program(idl, programID, provider);
            const program = getPumpProgram(connection, new PublicKey(programID));

            const zombieWallet = await getZombieWallet(project);

            const firstAddressLookup = new PublicKey("Ej3wFtgk3WywPnWPD3aychk38MqTdrjtqXkzbK8FpUih")

            const lookupTableAccounts = [];

            let lookupTableAccount = null;
            lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

            lookupTableAccounts.push(lookupTableAccount.value);

            if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                logToClients(myClients, "Failed to register Address Lookup.", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "Failed" }));
                return false;
            }

            let instructions = [];

            const solBalance = await getSafeSolBalance(signerKeypair.publicKey);
            const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL;
            const unitSlippage = 10 / 100;
            const numberAmount = maxSolCost / (1 + unitSlippage);
            const tokenAmount = buyItem.initialTokenAmount;

            // Mint Transaction
            const txMint = await buildMintTx(
                program,
                signerKeypair,
                new PublicKey(tokenMint),
                tokenName,
                tokenSymbol,
                tokenUri
            );

            //Buy Transaction
            const txBuyDev = await buildMintBuyTx(
                program,
                connection,
                signerKeypair,
                tokenMint,
                numberAmount,
                maxSolCost,
                tokenAmount,
                signerKeypair.publicKey
            );

            instructions = [...txMint.instructions, ...txBuyDev.instructions];
            let keypairArray = [signerKeypair, tokenAccount]

            /* Add Tip Instruction */
            instructions.push(
                // SystemProgram.transfer({
                //     fromPubkey: signerKeypair.publicKey,
                //     toPubkey: tipAccount,
                //     lamports: LAMPORTS_PER_SOL * jitoTip,
                // })
                CreateTraderAPITipInstruction(signerKeypair.publicKey, jitoTip * LAMPORTS_PER_SOL)
            )

            const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;

            const transactionMessage = new TransactionMessage({
                payerKey: signerKeypair.publicKey,
                instructions,
                recentBlockhash,
            });
            const mintTx = new VersionedTransaction(transactionMessage.compileToV0Message(lookupTableAccounts));

            mintTx.sign(keypairArray);


            console.log(await connection.simulateTransaction(mintTx));

            logToClients(myClients, "2. Submitting mint bundle transaction...", false);
            console.log("Sending mint trx..")

            const ret = await buildBundleOnNB([mintTx])

            if (!ret) {
                console.log("Failed to mint tokens!");
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            // Disable used PumpKeyPair
            const curPumpKeyPair = await PumpKeyPair.findOne({ publicKey: { $eq: tokenMint } });
            if (curPumpKeyPair && !curPumpKeyPair.isUsed) {
                curPumpKeyPair.isUsed = true;
                await curPumpKeyPair.save();
            }

            console.log("Success");

            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("MINT_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.buyPumpfunTokens = async (req, res) => {
    const { projectId } = req.body;
    console.log("Ghost bundling pumpfun tokens...", projectId);
    try {
        const project = await Project.findById(projectId);
        if ((req.user.role !== "admin" && project.userId !== req.user._id.toString()) || project.status !== "OPEN") {
            console.log("Mismatched user id or Not activated project!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch Or Not activated project",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const simulateData = project;

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const { connection } = useConnection();

            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            let accounts = {};
            let walletTokenAccounts = {};
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (!accounts[simulateData.wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: simulateData.wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", simulateData.wallets[i].address);
                        continue;
                    }
                    accounts[simulateData.wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            for (let i = 0; i < project.teamWallets.length; i++) {
                if (!accounts[project.teamWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.teamWallets[i].address);
                        continue;
                    }
                    accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            for (let i = 0; i < project.extraWallets.length; i++) {
                if (!accounts[project.extraWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.extraWallets[i].address);
                        continue;
                    }
                    accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            let buyItems = [];
            for (let i = 0; i < simulateData.wallets.length; i++) {
                if (simulateData.wallets[i].sim.buy.tokenAmount !== "" && simulateData.wallets[i].sim.buy.tokenAmount !== "0") {
                    try {
                        walletTokenAccounts[simulateData.wallets[i].address] = await getWalletTokenAccount(connection, accounts[simulateData.wallets[i].address].publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    if (buyItems.length == 0) {
                        buyItems.push({
                            address: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                            initialTokenAmount: simulateData.wallets[i].initialTokenAmount,
                            solAmount: simulateData.wallets[i].sim.buy.solAmount,
                        });
                    } else {
                        buyItems.push({
                            address: simulateData.wallets[i].address,
                            tokenAmount: simulateData.wallets[i].sim.buy.tokenAmount,
                            solAmount: simulateData.wallets[i].sim.buy.solAmount,
                        });
                    }
                }
            }

            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.buy.tokenAmount !== "" && project.teamWallets[i].sim.buy.tokenAmount !== "0") {
                    try {
                        walletTokenAccounts[project.teamWallets[i].address] = await getWalletTokenAccount(connection, accounts[project.teamWallets[i].address].publicKey);
                    }
                    catch (err) {
                        console.log(err);
                        logToClients(myClients, err, true);
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }

                    buyItems.push({
                        address: project.teamWallets[i].address,
                        tokenAmount: project.teamWallets[i].sim.buy.tokenAmount,
                        solAmount: project.teamWallets[i].sim.buy.solAmount,
                    });
                }
            }

            console.log("accounts: ", accounts)
            console.log("walletTokenAccounts: ", walletTokenAccounts)
            console.log("Buy Items:", buyItems.length);


            logToClients(myClients, "1. Generating bundle transactions...", false);

            const signerKeypair = accounts[buyItems[0].address];

            const tokenMint = simulateData.token.address;
            const tokenName = project.token.name;
            const tokenSymbol = project.token.symbol;
            const tokenUri = project.token.tokenUri;

            const keyArray = JSON.parse(project.token.privateKey)
            const privkey = new Uint8Array(keyArray)
            const keypair = Keypair.fromSecretKey(privkey)

            const tokenAccount = getKeypairFromBs58(bs58.encode(keypair.secretKey))

            // Create an AnchorProvider instance
            const provider = new anchor.AnchorProvider(
                connection,
                new anchor.Wallet(signerKeypair),
                anchor.AnchorProvider.defaultOptions()
            );

            // const program = new anchor.Program(idl, programID, provider);
            const program = getPumpProgram(connection, new PublicKey(programID));

            // Create a Lookup Table
            let pumpPoolKeys = await getPumpPoolKeys(program, new PublicKey(tokenMint))
            let allPubKeys = [
                new PublicKey(programID),
                new PublicKey(MEMO_PROGRAM_ID),
                new PublicKey(feeRecipient),
                new PublicKey(EVENT_AUTH),
                NATIVE_MINT,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenAccount.publicKey,
                SYSVAR_RENT_PUBKEY,
                new PublicKey("ComputeBudget111111111111111111111111111111"),  // Compute Budget
                new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"), // global state
                new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
                SystemProgram.programId
            ]
            allPubKeys = [...allPubKeys, ...pumpPoolKeys]

            const zombieWallet = await getZombieWallet(project);

            for (let idx = 0; idx < buyItems.length; idx++) {
                const wallet = new PublicKey(buyItems[idx].address);
                const tokenAccount = await getAssociatedTokenAddress(
                    new PublicKey(tokenMint),
                    wallet
                );
                const wrappedAccount = await getAssociatedTokenAddress(NATIVE_MINT, wallet);
                allPubKeys.push(wallet);
                allPubKeys.push(tokenAccount);
                allPubKeys.push(wrappedAccount);
            }

            // const firstAddressLookup = await createAddressLookupWithAddressList(
            //     connection,
            //     allPubKeys,
            //     zombieWallet
            // );

            // if (!firstAddressLookup) return null;
            const firstAddressLookup = new PublicKey("Ej3wFtgk3WywPnWPD3aychk38MqTdrjtqXkzbK8FpUih")

            await sleep(5000);

            const lookupTableAccounts = [];

            const startTime = Date.now();
            const TIMEOUT = 30000;
            let lookupTableAccount = null;

            // while (Date.now() - startTime < TIMEOUT) {
            //     console.log("---- verifing lookup Table", firstAddressLookup)
            lookupTableAccount = (await connection.getAddressLookupTable(firstAddressLookup));

            //     if (lookupTableAccount.value && lookupTableAccount.value.state && lookupTableAccount.value.state.addresses.length >= allPubKeys.length) {
            //         console.log(`https://explorer.solana.com/address/${firstAddressLookup.toString()}/entries?cluster=mainnet`)
            //         break;
            //     }
            //     await sleep(1000)
            // }

            lookupTableAccounts.push(lookupTableAccount.value);

            if (!lookupTableAccounts || lookupTableAccounts[0] == null) {
                logToClients(myClients, "Failed to register Address Lookup.", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("DISPERSE_COMPLETED", JSON.stringify({ message: "Failed" }));
                return false;
            }

            let innerTxns = [];
            let instructions = [];
            let zombieKeypairList = [];
            let instructionCount = 0;

            for (let i = 0; i < buyItems.length; i++) {
                const zombieKeypair = accounts[buyItems[i].address];

                const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
                const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL;
                const unitSlippage = 10 / 100;
                const numberAmount = maxSolCost / (1 + unitSlippage);
                const tokenAmount = buyItems[i].tokenAmount;

                if (i === 0) {
                    //Buy Transaction
                    if (tokenAmount - buyItems[0].initialTokenAmount == 0) continue;

                    const txBuyDev = await buildMintBuyTx(
                        program,
                        connection,
                        signerKeypair,
                        tokenMint,
                        numberAmount,
                        maxSolCost,
                        tokenAmount - buyItems[0].initialTokenAmount,
                        signerKeypair.publicKey
                    );

                    instructions = [...txBuyDev.instructions];
                    zombieKeypairList = [signerKeypair];
                    instructionCount++;

                    if (buyItems.length === 1) {
                        /* Add Tip Instruction */
                        let newInnerTransactions = [];
                        newInnerTransactions.push(
                            // SystemProgram.transfer({
                            //     fromPubkey: accounts[buyItems[i].address].publicKey,
                            //     toPubkey: tipAccount,
                            //     lamports: LAMPORTS_PER_SOL * jitoTip,
                            // })
                            CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
                        )

                        innerTxns.push({
                            txns: newInnerTransactions,
                            signers: [signerKeypair],
                            payer: signerKeypair,
                        });
                    }
                }
                else {
                    //Buy Transaction
                    const txBuyZombie = await buildMintBuyTx(
                        program,
                        connection,
                        zombieKeypair,
                        tokenMint.toString(),
                        numberAmount,
                        maxSolCost,
                        tokenAmount,
                        accounts[buyItems[0].address].publicKey
                    );

                    if (i === buyItems.length - 1) {
                        /* Add Tip Instruction */
                        let newInnerTransactions = [...txBuyZombie.instructions];
                        newInnerTransactions.push(
                            // SystemProgram.transfer({
                            //     fromPubkey: accounts[buyItems[i].address].publicKey,
                            //     toPubkey: tipAccount,
                            //     lamports: LAMPORTS_PER_SOL * jitoTip,
                            // })
                            CreateTraderAPITipInstruction(accounts[buyItems[i].address].publicKey, LAMPORTS_PER_SOL * jitoTip)
                        )

                        // add to instructions
                        instructions.push(...newInnerTransactions);
                        zombieKeypairList.push(zombieKeypair);

                        // add to innerTxns
                        innerTxns.push({
                            txns: [...instructions],
                            signers: [...zombieKeypairList],
                            payer: zombieKeypairList[0],
                        });

                        instructions = [];
                        zombieKeypairList = [];
                        instructionCount = 0;
                    }
                    else {

                        // add to instructions
                        instructions.push(...txBuyZombie.instructions);
                        zombieKeypairList.push(zombieKeypair);
                        instructionCount++;

                        if (instructionCount >= process.env.INSTRUCTION_LIMIT) {
                            innerTxns.push({
                                txns: [...instructions],
                                signers: [...zombieKeypairList],
                                payer: zombieKeypairList[0],
                            });

                            instructions = [];
                            zombieKeypairList = [];
                            instructionCount = 0;
                        }
                    }
                }
            }

            let extraInnerTxns = [];
            instructions = []
            zombieKeypairList = []
            console.log("-------Extra Wallets", project.extraWallets)
            for (let i = 0; i < project.extraWallets.length; i++) {
                const zombieKeypair = accounts[project.extraWallets[i].address];
                console.log(zombieKeypair)

                const solBalance = await getSafeSolBalance(zombieKeypair.publicKey);
                const maxSolCost = Number(solBalance) * 0.98 / LAMPORTS_PER_SOL - 0.02;
                const unitSlippage = 10 / 100;
                const numberAmount = maxSolCost / (1 + unitSlippage);
                const tokenAmount = project.extraWallets[i].sim.buy.tokenAmount;
                const solRequired = Number(project.extraWallets[i].sim.buy.solAmount) / LAMPORTS_PER_SOL;

                if (maxSolCost < solRequired) continue;

                const txBuyZombie = await buildMintBuyTx(
                    program,
                    connection,
                    zombieKeypair,
                    tokenMint.toString(),
                    numberAmount,
                    maxSolCost,
                    tokenAmount,
                    accounts[buyItems[0].address].publicKey
                );

                let newInnerTransactions = [...txBuyZombie.instructions];
                instructions.push(...newInnerTransactions);
                zombieKeypairList.push(zombieKeypair);
            }

            if (zombieKeypairList.length > 0) {
                extraInnerTxns.push({
                    txns: [...instructions],
                    signers: [...zombieKeypairList],
                    payer: zombieKeypairList[0],
                });
            }

            let verTxns = [];

            logToClients(myClients, "2. Submitting bundle transactions...", false);

            console.log("Sending compressed trxs")

            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            for (let i = 0; i < innerTxns.length; i++) {
                verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...innerTxns[i].txns], recentBlockhash, [...innerTxns[i].signers], innerTxns[i].payer))
            }

            try {
                for (let i = 0; i < extraInnerTxns.length; i++) {
                    verTxns.push(makeVerTxWithLUT(lookupTableAccounts[0], [...extraInnerTxns[i].txns], recentBlockhash, [...extraInnerTxns[i].signers], extraInnerTxns[i].payer))
                }
            } catch (error) {
                console.log(error);
            }

            verTxns.forEach(async tx => {
                let sim = await connection.simulateTransaction(tx)
                console.log("--------------- simulattion:\n", sim)
            });

            const ret = await buildBundleOnNB([verTxns])

            if (!ret) {
                console.log("Failed to buy tokens!");
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
                return;
            }

            const curPumpKeyPair = await PumpKeyPair.findOne({ publicKey: { $eq: tokenMint } });
            if (curPumpKeyPair && !curPumpKeyPair.isUsed) {
                curPumpKeyPair.isUsed = true;
                await curPumpKeyPair.save();
            }

            logToClients(myClients, "3. Transferring tokens...", false);

            const wallets = project.wallets.filter(item => item.sim.enabled);
            const mint = new PublicKey(project.token.address);

            let xferItemsByFrom = {};
            if (PAYMENT_OPTIONS[project.paymentId].token > 0) {
                if (buyItems.length >= 2)
                    xferItemsByFrom[buyItems[1].address] = [
                        {
                            from: buyItems[1].address,
                            to: getTaxWallet(),
                            tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
                        }
                    ]
                else
                    xferItemsByFrom[buyItems[0].address] = [
                        {
                            from: buyItems[0].address,
                            to: getTaxWallet(),
                            tokenAmount: 10000000 * PAYMENT_OPTIONS[project.paymentId].token
                        }
                    ]
            }

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
                    continue;

                const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.teamWallets[i].address].publicKey);

                let tokenBalance = null;
                try {
                    const tokenAccountInfo = await getAccount(connection, associatedToken);
                    tokenBalance = new BN(tokenAccountInfo.amount);
                }
                catch (err) {
                    console.log(err);
                }

                if (!tokenBalance || tokenBalance.lt(new BN(project.teamWallets[i].sim.xfer.tokenAmount))) {
                    if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
                        xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                            ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
                            {
                                from: project.teamWallets[i].sim.xfer.fromAddress,
                                to: project.teamWallets[i].address,
                                tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                    else {
                        xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                            {
                                from: project.teamWallets[i].sim.xfer.fromAddress,
                                to: project.teamWallets[i].address,
                                tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                }
            }
            // }

            for (let i = 0; i < wallets.length; i++) {
                if (wallets[i].address === wallets[i].sim.xfer.fromAddress)
                    continue;

                const associatedToken = getAssociatedTokenAddressSync(mint, accounts[wallets[i].address].publicKey);



                let tokenBalance = null;
                try {
                    const tokenAccountInfo = await getAccount(connection, associatedToken);
                    tokenBalance = new BN(tokenAccountInfo.amount);
                }
                catch (err) {
                    console.log(err);
                }

                if (!tokenBalance || tokenBalance.lt(new BN(wallets[i].sim.xfer.tokenAmount))) {
                    if (xferItemsByFrom[wallets[i].sim.xfer.fromAddress]) {
                        xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
                            ...xferItemsByFrom[wallets[i].sim.xfer.fromAddress],
                            {
                                from: wallets[i].sim.xfer.fromAddress,
                                to: wallets[i].address,
                                tokenAmount: wallets[i].sim.xfer.tokenAmount,
                            },
                        ];
                    }
                    else {
                        xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
                            {
                                from: wallets[i].sim.xfer.fromAddress,
                                to: wallets[i].address,
                                tokenAmount: wallets[i].sim.xfer.tokenAmount,
                            },
                        ];
                    }
                }
            }

            console.log("xferItemsByFrom: ", xferItemsByFrom)

            let dispersed = true;
            const USE_JITO = true;
            if (USE_JITO) {
                let bundleItems = [];
                let bundleIndex = -1;
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        let instructions = [];
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to));
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    instructions.push(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to),
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            instructions.push(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                                bundleItems[bundleIndex].push({
                                    instructions: instructions,
                                    signers: signers,
                                    payer: accounts[from].publicKey,
                                });
                            }
                            else {
                                bundleItems.push([
                                    {
                                        instructions: instructions,
                                        signers: signers,
                                        payer: accounts[from].publicKey,
                                    }
                                ]);
                                bundleIndex++;
                            }
                        }
                        else
                            break;

                        index += count;
                    }
                }

                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    let bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
                                ...bundleItem[j].instructions
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    console.log("Failed to transfer tokens");
                    dispersed = false;
                }
            }
            else {
                let transactions = [];
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        const tx = new Transaction();
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    tx.add(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to].publicKey,
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            tx.add(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (tx.instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            transactions = [
                                ...transactions,
                                {
                                    transaction: tx,
                                    signers: signers,
                                }
                            ];
                        }
                        else
                            break;

                        index += count;
                    }
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to transfer tokens");
                        dispersed = false;
                    }
                }
            }

            console.log("Success");
            project.status = "TRADE";
            await project.save();

            const html = `<p>Name: ${project.name}</p><p>Token: ${project.token.address}</p>`;
            const mails = await Email.find();
            let pendings = [];
            for (let i = 0; i < mails.length; i++) {
                pendings = [
                    ...pendings,
                    sendEmail({
                        to: mails[i].email,
                        subject: process.env.SUBJECT_FOR_LAUNCH_TOKEN,
                        html: html
                    }, async (err, data) => {
                        if (err || data.startsWith("Error")) {
                            console.log(err);
                            return;
                        }

                        console.log('Mail sent successfully with data: ' + data);
                    })
                ];
            }

            // startMetric(project._id.toString());
            const projectForUser = await Project.findById(simulateData.projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("BUY_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.disperseTokens = async (req, res) => {
    const { projectId } = req.body;
    console.log("Dispersing tokens...", projectId);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const mint = new PublicKey(project.token.address);
            const mintInfo = await getMint(connection, mint);

            const wallets = project.wallets.filter(item => item.sim.enabled);

            let accounts = {};
            for (let i = 0; i < wallets.length; i++) {
                if (!accounts[wallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: wallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", wallets[i].address);
                        continue;
                    }
                    accounts[wallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            for (let i = 0; i < project.teamWallets.length; i++) {
                if (!accounts[project.teamWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.teamWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.teamWallets[i].address);
                        continue;
                    }
                    accounts[project.teamWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }
            for (let i = 0; i < project.extraWallets.length; i++) {
                if (!accounts[project.extraWallets[i].address]) {
                    const walletItem = await Wallet.findOne({ address: project.extraWallets[i].address });
                    if (!walletItem) {
                        console.log("Invalid wallet:", project.extraWallets[i].address);
                        continue;
                    }
                    accounts[project.extraWallets[i].address] = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                }
            }

            let xferItemsByFrom = {};

            // if (project.paymentId != 1) {
            for (let i = 0; i < project.teamWallets.length; i++) {
                if (project.teamWallets[i].sim.xfer.fromAddress === project.teamWallets[i].address)
                    continue;

                const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.teamWallets[i].address].publicKey);

                let tokenBalance = null;
                try {
                    const tokenAccountInfo = await getAccount(connection, associatedToken);
                    tokenBalance = new BN(tokenAccountInfo.amount);
                }
                catch (err) {
                    console.log(err);
                }

                if (!tokenBalance || tokenBalance.lt(new BN(project.teamWallets[i].sim.xfer.tokenAmount))) {
                    if (xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress]) {
                        xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                            ...xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress],
                            {
                                from: project.teamWallets[i].sim.xfer.fromAddress,
                                to: project.teamWallets[i].address,
                                tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                    else {
                        xferItemsByFrom[project.teamWallets[i].sim.xfer.fromAddress] = [
                            {
                                from: project.teamWallets[i].sim.xfer.fromAddress,
                                to: project.teamWallets[i].address,
                                tokenAmount: project.teamWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                }
            }
            for (let i = 0; i < project.extraWallets.length; i++) {
                if (project.extraWallets[i].sim.xfer.fromAddress === project.extraWallets[i].address)
                    continue;

                const associatedToken = getAssociatedTokenAddressSync(mint, accounts[project.extraWallets[i].address].publicKey);

                let tokenBalance = null;
                try {
                    const tokenAccountInfo = await getAccount(connection, associatedToken);
                    tokenBalance = new BN(tokenAccountInfo.amount);
                }
                catch (err) {
                    console.log(err);
                }

                if (!tokenBalance || tokenBalance.lt(new BN(project.extraWallets[i].sim.xfer.tokenAmount))) {
                    if (xferItemsByFrom[project.extraWallets[i].sim.xfer.fromAddress]) {
                        xferItemsByFrom[project.extraWallets[i].sim.xfer.fromAddress] = [
                            ...xferItemsByFrom[project.extraWallets[i].sim.xfer.fromAddress],
                            {
                                from: project.extraWallets[i].sim.xfer.fromAddress,
                                to: project.extraWallets[i].address,
                                tokenAmount: project.extraWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                    else {
                        xferItemsByFrom[project.extraWallets[i].sim.xfer.fromAddress] = [
                            {
                                from: project.extraWallets[i].sim.xfer.fromAddress,
                                to: project.extraWallets[i].address,
                                tokenAmount: project.extraWallets[i].sim.xfer.tokenAmount,
                            }
                        ];
                    }
                }
            }
            // }

            for (let i = 0; i < wallets.length; i++) {
                if (wallets[i].address === wallets[i].sim.xfer.fromAddress)
                    continue;

                const associatedToken = getAssociatedTokenAddressSync(mint, accounts[wallets[i].address].publicKey);
                let tokenBalance = null;
                try {
                    const tokenAccountInfo = await getAccount(connection, associatedToken);
                    tokenBalance = new BN(tokenAccountInfo.amount);
                }
                catch (err) {
                    console.log(err);
                }

                if (!tokenBalance || tokenBalance.lt(new BN(wallets[i].sim.xfer.tokenAmount))) {
                    if (xferItemsByFrom[wallets[i].sim.xfer.fromAddress]) {
                        xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
                            ...xferItemsByFrom[wallets[i].sim.xfer.fromAddress],
                            {
                                from: wallets[i].sim.xfer.fromAddress,
                                to: wallets[i].address,
                                tokenAmount: wallets[i].sim.xfer.tokenAmount,
                            },
                        ];
                    }
                    else {
                        xferItemsByFrom[wallets[i].sim.xfer.fromAddress] = [
                            {
                                from: wallets[i].sim.xfer.fromAddress,
                                to: wallets[i].address,
                                tokenAmount: wallets[i].sim.xfer.tokenAmount,
                            },
                        ];
                    }
                }
            }
            console.log("xferItemsByFrom: ", xferItemsByFrom)

            let dispersed = true;
            const USE_JITO = true;
            if (USE_JITO) {
                let bundleItems = [];
                let bundleIndex = -1;
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        let instructions = [];
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to));
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    instructions.push(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to]?.publicKey ? accounts[xferItems[i].to]?.publicKey : new PublicKey(xferItems[i].to),
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            instructions.push(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                                bundleItems[bundleIndex].push({
                                    instructions: instructions,
                                    signers: signers,
                                    payer: accounts[from].publicKey,
                                });
                            }
                            else {
                                bundleItems.push([
                                    {
                                        instructions: instructions,
                                        signers: signers,
                                        payer: accounts[from].publicKey,
                                    }
                                ]);
                                bundleIndex++;
                            }
                        }
                        else
                            break;

                        index += count;
                    }
                }

                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    let bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions = [
                                CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip),
                                ...bundleItem[j].instructions
                            ];
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    console.log("Failed to transfer tokens");
                    dispersed = false;
                }
            }
            else {
                let transactions = [];
                for (let from in xferItemsByFrom) {
                    const signers = [accounts[from]];
                    let xferItems = xferItemsByFrom[from];
                    let index = 0;
                    while (index < xferItems.length) {
                        let count = 0;
                        const tx = new Transaction();
                        for (let i = index; i < xferItems.length; i++) {
                            const fromTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].from].publicKey);
                            if (!fromTokenAccount)
                                continue;

                            const toTokenAccount = getAssociatedTokenAddressSync(mint, accounts[xferItems[i].to].publicKey);
                            try {
                                const info = await connection.getAccountInfo(toTokenAccount);
                                if (!info) {
                                    tx.add(
                                        createAssociatedTokenAccountInstruction(
                                            accounts[from].publicKey,
                                            toTokenAccount,
                                            accounts[xferItems[i].to].publicKey,
                                            mint
                                        )
                                    );
                                }
                            }
                            catch (err) {
                                console.log(err);
                            }

                            tx.add(
                                createTransferInstruction(
                                    fromTokenAccount,
                                    toTokenAccount,
                                    accounts[xferItems[i].from].publicKey,
                                    xferItems[i].tokenAmount * Math.pow(10, Number(project.token.decimals))
                                )
                            );

                            count++;
                            if (count === 5)
                                break;
                        }

                        if (tx.instructions.length > 0) {
                            console.log("Transferring tokens...", from, index, index + count - 1);
                            transactions = [
                                ...transactions,
                                {
                                    transaction: tx,
                                    signers: signers,
                                }
                            ];
                        }
                        else
                            break;

                        index += count;
                    }
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to transfer tokens");
                        dispersed = false;
                    }
                }
            }

            console.log("Success");
            await project.save();

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("DISPERSE_TOKENS_COMPLETED", JSON.stringify({ message: (dispersed ? "OK" : "Failed"), project: project }));
                else
                    myClients[k].emit("DISPERSE_TOKENS_COMPLETED", JSON.stringify({ message: (dispersed ? "OK" : "Failed"), project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);
            for (let k = 0; k < myClients.length; k++)
                myClients[k].emit("DISPERSE_TOKENS_COMPLETED", JSON.stringify({ message: "Failed" }));
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.sellAllFromExtraWallet = async (req, res) => {
    const { projectId, poolInfo, token } = req.body;

    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(200).json({
                success: true
            });
            return;
        }

        await sellAllTokensFromExtraWallet(project, poolInfo, token);
        res.status(200).json({
            success: true
        });
    } catch (err) {
        res.status(200).json({
            success: true
        });
    }
}

exports.sellTokens = async (req, res) => {
    const { projectId, token, poolInfo, wallets, teamWallets } = req.body;
    console.log("Selling token...", projectId, token, poolInfo, wallets, teamWallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const mint = new PublicKey(token);
            const mintInfo = await getMint(connection, mint);
            const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
            const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
            const slippage = new Percent(10, 100);
            const poolKeys = jsonInfo2PoolKeys(poolInfo);
            const zero = new BN(0);

            const tWallets = [
                ...teamWallets,
                ...wallets,
            ];

            const USE_JITO = true;
            let pendingBundleResponse = [];
            for (let i = 0; i < tWallets.length; i++) {
                const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                if (!walletItem)
                    continue;

                const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey);
                let tokenAccountInfo = null;
                try {
                    tokenAccountInfo = await getAccount(connection, associatedToken);

                    const tokenBalance = new BN(tokenAccountInfo.amount);
                    if (tokenBalance.lte(zero))
                        continue;
                }
                catch (err) {
                    console.log(err);
                    continue;
                }

                let walletTokenAccount = null;
                try {
                    walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
                }
                catch (err) {
                    console.log(err);
                    continue;
                }

                if (USE_JITO) {
                    // const solBalance = new BN(await connection.getBalance(account.publicKey));
                    // if (solBalance.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                    //     console.log("Insufficient SOL!", account.publicKey.toBase58());
                    //     continue;
                    // }

                    try {
                        console.log("Selling token from", tWallets[i].address);
                        const tokenAmount = new BigNumber(tokenAccountInfo.amount.toString()).multipliedBy(new BigNumber(tWallets[i].percentage.toString())).dividedBy(new BigNumber("100"));
                        const baseAmount = new TokenAmount(baseToken, new BN(tokenAmount.toFixed(0)));
                        const minQuoteAmount = new TokenAmount(quoteToken, new BN("1"));
                        // const { minAmountOut: minQuoteAmount } = Liquidity.computeAmountOut({
                        //     poolKeys: poolKeys,
                        //     poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                        //     amountIn: baseAmount,
                        //     currencyOut: quoteToken,
                        //     slippage: slippage,
                        // });

                        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                            connection,
                            poolKeys,
                            userKeys: {
                                tokenAccounts: walletTokenAccount,
                                owner: account.publicKey,
                            },
                            amountIn: baseAmount,
                            amountOut: minQuoteAmount,
                            fixedSide: 'in',
                            makeTxVersion: TxVersion.V0,
                        });

                        /* Add Tip Instruction */
                        let newInnerTransactions = [...innerTransactions];
                        if (newInnerTransactions.length > 0) {
                            const p = newInnerTransactions.length - 1;
                            newInnerTransactions[p].instructionTypes = [
                                50,
                                ...newInnerTransactions[p].instructionTypes,
                            ];
                            newInnerTransactions[p].instructions = [
                                CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * jitoTip),
                                ...newInnerTransactions[p].instructions,
                            ];
                        }

                        const verTxns = await buildSimpleTransaction({
                            connection: connection,
                            makeTxVersion: TxVersion.V0,
                            payer: account.publicKey,
                            innerTransactions: newInnerTransactions,
                        });

                        for (let j = 0; j < verTxns.length; j++)
                            verTxns[j].sign([account]);

                        const ret = buildBundleOnNB(verTxns);
                        await sleep(200);
                        pendingBundleResponse = [
                            ...pendingBundleResponse,
                            ret,
                        ];
                    }
                    catch (err) {
                        console.log(err);
                        continue;
                    }
                }
                else {
                    console.log("Selling token from", tWallets[i].address);
                    const tokenAmount = new BigNumber(tokenAccountInfo.amount.toString()).multipliedBy(new BigNumber(tWallets[i].percentage.toString())).dividedBy(new BigNumber("100"));
                    const baseAmount = new TokenAmount(baseToken, new BN(tokenAmount.toFixed(0)));
                    const { minAmountOut: minQuoteAmount } = Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                        amountIn: baseAmount,
                        currencyOut: quoteToken,
                        slippage: slippage,
                    });

                    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                        connection,
                        poolKeys,
                        userKeys: {
                            tokenAccounts: walletTokenAccount,
                            owner: account.publicKey,
                        },
                        amountIn: baseAmount,
                        amountOut: minQuoteAmount,
                        fixedSide: 'in',
                        makeTxVersion: TxVersion.V0,
                    });

                    const transactions = await buildSimpleTransaction({
                        connection: connection,
                        makeTxVersion: TxVersion.V0,
                        payer: account.publicKey,
                        innerTransactions: innerTransactions
                    });

                    for (let j = 0; j < transactions.length; j++)
                        transactions[j].sign([account]);

                    const ret = await sendAndConfirmVersionedTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to sell tokens");
                        const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                            else
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                        }
                        return;
                    }
                }
            }

            if (USE_JITO) {
                if (pendingBundleResponse.length > 0) {
                    let succeed = false;
                    const rets = await Promise.all(pendingBundleResponse);
                    for (let k = 0; k < rets.length; k++) {
                        if (rets[k]) {
                            succeed = true;
                            break;
                        }
                    }

                    if (!succeed) {
                        const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                            else
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                        }
                        return;
                    }
                }
                else {
                    const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                    for (let k = 0; k < myClients.length; k++) {
                        if (myClients[k].user.role === "admin")
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                        else
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                    }
                    return;
                }
            }

            // let transactions = [];
            // for (let i = 0; i < tWallets.length; i++) {
            //     const walletItem = await Wallet.findOne({ address: tWallets[i].address });
            //     if (!walletItem)
            //         continue;

            //     const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
            //     try {
            //         const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey);
            //         const tokenAccountInfo = await getAccount(connection, associatedToken);
            //         const tokenBalance = new BN(tokenAccountInfo.amount);
            //         if (tokenBalance.lte(zero)) {
            //             console.log("Trying to close token account...", tWallets[i].address);
            //             try {
            //                 const tx = new Transaction().add(
            //                     createCloseAccountInstruction(
            //                         tokenAccountInfo.address,
            //                         account.publicKey,
            //                         account.publicKey)
            //                 );
            //                 transactions = [
            //                     ...transactions,
            //                     {
            //                         transaction: tx,
            //                         signers: [account],
            //                     }
            //                 ];
            //             }
            //             catch (err) {
            //                 // console.log(err);
            //             }
            //         }
            //     }
            //     catch (err) {
            //         console.log(err);
            //     }
            // }

            // if (transactions.length > 0) {
            //     const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
            //     if (!ret) {
            //         console.log("Failed to close token account");
            //         const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            //         for (let k = 0; k < myClients.length; k++) {
            //             if (myClients[k].user.role === "admin")
            //                 myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
            //             else
            //                 myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            //         }
            //         return;
            //     }
            // }

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.sellPumpfunTokens = async (req, res) => {
    const { projectId, token, poolInfo, wallets, teamWallets } = req.body;
    console.log("Selling token...", projectId, token, poolInfo, wallets, teamWallets);

    // check token
    try {
        const result = await axios.get(`https://frontend-api.pump.fun/coins/${token}`);
        console.log(result.data.raydium_pool)
        if (result.data.raydium_pool === null)
            await sellPumpfunTokenFunc(req.user, res, projectId, token, poolInfo, wallets, teamWallets);
        else
            await sellRaydiumTokenFunc(req, res, projectId, token, poolInfo, wallets, teamWallets);
    } catch (err) {
        console.log(err);
        res.status(200).json({
            success: false
        });
    }
}

async function sellPumpfunTokenFunc(user, res, projectId, token, poolInfo, wallets, teamWallets) {
    try {
        const project = await Project.findById(projectId);
        if (user.role !== "admin" && project.userId !== user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === user._id.toString());
        try {
            const jitoTip = user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();

            const tWallets = [
                ...teamWallets,
                ...wallets,
            ];

            const USE_JITO = true;
            let pendingBundleResponse = [];
            console.log("tWallets :", tWallets)

            const walletItem = await Wallet.findOne({ address: tWallets[0].address });
            const signerKeypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));

            // Create an AnchorProvider instance
            const provider = new anchor.AnchorProvider(
                connection,
                new anchor.Wallet(signerKeypair),
                anchor.AnchorProvider.defaultOptions()
            );

            // const program = new anchor.Program(idl, programID, provider);
            const program = getPumpProgram(connection, new PublicKey(programID));

            let innerTxns = [];
            const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;

            for (let i = 0; i < tWallets.length; i++) {
                // get token balance
                const tokenBalance = await getSafeTokenBalance(
                    tWallets[i].address,
                    token
                );
                if (tokenBalance > 0) {
                    // get zombie wallet info
                    const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                    const zombieKeypair = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));

                    let txSell = await buildSellTx(
                        program,
                        connection,
                        zombieKeypair,
                        token,
                        tWallets[i].percentage,
                        0
                    );

                    /* Add Tip Instruction */
                    let newInnerTransactions = [...txSell.instructions];
                    newInnerTransactions.push(
                        CreateTraderAPITipInstruction(zombieKeypair.publicKey, LAMPORTS_PER_SOL * jitoTip)
                    )

                    const transactionMessage = new TransactionMessage({
                        payerKey: zombieKeypair.publicKey,
                        instructions: newInnerTransactions,
                        recentBlockhash,
                    });
                    const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                    tx.sign([zombieKeypair]);

                    const ret = buildBundleOnNB([tx]);
                    pendingBundleResponse = [
                        ...pendingBundleResponse,
                        ret,
                    ];
                }
            }

            if (USE_JITO) {
                console.log("pendingBundleResponse: ", pendingBundleResponse)
                if (pendingBundleResponse.length > 0) {
                    let succeed = false;
                    const rets = await Promise.all(pendingBundleResponse);
                    for (let k = 0; k < rets.length; k++) {
                        if (rets[k]) {
                            succeed = true;
                            break;
                        }
                    }

                    if (!succeed) {
                        const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                            else
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                        }
                        return;
                    }
                }
                else {
                    const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                    for (let k = 0; k < myClients.length; k++) {
                        if (myClients[k].user.role === "admin")
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                        else
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                    }
                    return;
                }
            }

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

async function sellRaydiumTokenFunc(req, res, projectId, token, poolInfo, wallets, teamWallets) {
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const mint = new PublicKey(token);

            const mintInfo = await getMint(connection, mint);
            const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
            const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
            const slippage = new Percent(10, 100);
            if (!project.poolInfo || project.poolInfo.baseMint !== token) {
                project.poolInfo = await getPoolInfo(connection, token);
                console.log("project.poolInfo: ", project.poolInfo)
                await project.save();
            }

            const poolKeys = jsonInfo2PoolKeys(project.poolInfo);
            const zero = new BN(0);

            const tWallets = [
                ...teamWallets,
                ...wallets,
            ];

            const USE_JITO = true;
            let pendingBundleResponse = [];
            for (let i = 0; i < tWallets.length; i++) {
                const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                if (!walletItem)
                    continue;

                const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey);
                let tokenAccountInfo = null;
                try {
                    tokenAccountInfo = await getAccount(connection, associatedToken);

                    const tokenBalance = new BN(tokenAccountInfo.amount);
                    if (tokenBalance.lte(zero))
                        continue;
                }
                catch (err) {
                    console.log(err);
                    continue;
                }

                let walletTokenAccount = null;
                try {
                    walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
                }
                catch (err) {
                    console.log(err);
                    continue;
                }

                if (USE_JITO) {
                    const solBalance = new BN(await connection.getBalance(account.publicKey));
                    if (solBalance.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                        console.log("Insufficient SOL!", account.publicKey.toBase58());
                        continue;
                    }

                    try {
                        console.log("Selling token from", tWallets[i].address);
                        const tokenAmount = new BigNumber(tokenAccountInfo.amount.toString()).multipliedBy(new BigNumber(tWallets[i].percentage.toString())).dividedBy(new BigNumber("100"));
                        const baseAmount = new TokenAmount(baseToken, new BN(tokenAmount.toFixed(0)));
                        const minQuoteAmount = new TokenAmount(quoteToken, new BN("1"));

                        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                            connection,
                            poolKeys,
                            userKeys: {
                                tokenAccounts: walletTokenAccount,
                                owner: account.publicKey,
                            },
                            amountIn: baseAmount,
                            amountOut: minQuoteAmount,
                            fixedSide: 'in',
                            makeTxVersion: TxVersion.V0,
                        });

                        /* Add Tip Instruction */
                        let newInnerTransactions = [...innerTransactions];
                        if (newInnerTransactions.length > 0) {
                            const p = newInnerTransactions.length - 1;
                            newInnerTransactions[p].instructionTypes = [
                                50,
                                ...newInnerTransactions[p].instructionTypes,
                            ];
                            newInnerTransactions[p].instructions = [
                                CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * jitoTip),
                                ...newInnerTransactions[p].instructions,
                            ];
                        }

                        const verTxns = await buildSimpleTransaction({
                            connection: connection,
                            makeTxVersion: TxVersion.V0,
                            payer: account.publicKey,
                            innerTransactions: newInnerTransactions,
                        });

                        for (let j = 0; j < verTxns.length; j++)
                            verTxns[j].sign([account]);

                        const ret = buildBundleOnNB(verTxns);
                        pendingBundleResponse = [
                            ...pendingBundleResponse,
                            ret,
                        ];
                    }
                    catch (err) {
                        console.log(err);
                        continue;
                    }
                }
                else {
                    console.log("Selling token from", tWallets[i].address);
                    const tokenAmount = new BigNumber(tokenAccountInfo.amount.toString()).multipliedBy(new BigNumber(tWallets[i].percentage.toString())).dividedBy(new BigNumber("100"));
                    const baseAmount = new TokenAmount(baseToken, new BN(tokenAmount.toFixed(0)));
                    const { minAmountOut: minQuoteAmount } = Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                        amountIn: baseAmount,
                        currencyOut: quoteToken,
                        slippage: slippage,
                    });

                    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                        connection,
                        poolKeys,
                        userKeys: {
                            tokenAccounts: walletTokenAccount,
                            owner: account.publicKey,
                        },
                        amountIn: baseAmount,
                        amountOut: minQuoteAmount,
                        fixedSide: 'in',
                        makeTxVersion: TxVersion.V0,
                    });

                    const transactions = await buildSimpleTransaction({
                        connection: connection,
                        makeTxVersion: TxVersion.V0,
                        payer: account.publicKey,
                        innerTransactions: innerTransactions
                    });

                    for (let j = 0; j < transactions.length; j++)
                        transactions[j].sign([account]);

                    const ret = await sendAndConfirmVersionedTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to sell tokens");
                        const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                            else
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                        }
                        return;
                    }
                }
            }

            if (USE_JITO) {
                if (pendingBundleResponse.length > 0) {
                    let succeed = false;
                    const rets = await Promise.all(pendingBundleResponse);
                    for (let k = 0; k < rets.length; k++) {
                        if (rets[k]) {
                            succeed = true;
                            break;
                        }
                    }

                    if (!succeed) {
                        const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                        for (let k = 0; k < myClients.length; k++) {
                            if (myClients[k].user.role === "admin")
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                            else
                                myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                        }
                        return;
                    }
                }
                else {
                    const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
                    for (let k = 0; k < myClients.length; k++) {
                        if (myClients[k].user.role === "admin")
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                        else
                            myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
                    }
                    return;
                }
            }

            // let transactions = [];
            // for (let i = 0; i < tWallets.length; i++) {
            //     const walletItem = await Wallet.findOne({ address: tWallets[i].address });
            //     if (!walletItem)
            //         continue;

            //     const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
            //     try {
            //         const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey);
            //         const tokenAccountInfo = await getAccount(connection, associatedToken);
            //         const tokenBalance = new BN(tokenAccountInfo.amount);
            //         if (tokenBalance.lte(zero)) {
            //             console.log("Trying to close token account...", tWallets[i].address);
            //             try {
            //                 const tx = new Transaction().add(
            //                     createCloseAccountInstruction(
            //                         tokenAccountInfo.address,
            //                         account.publicKey,
            //                         account.publicKey)
            //                 );
            //                 transactions = [
            //                     ...transactions,
            //                     {
            //                         transaction: tx,
            //                         signers: [account],
            //                     }
            //                 ];
            //             }
            //             catch (err) {
            //                 // console.log(err);
            //             }
            //         }
            //     }
            //     catch (err) {
            //         console.log(err);
            //     }
            // }

            // if (transactions.length > 0) {
            //     const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
            //     if (!ret) {
            //         console.log("Failed to close token account");
            //         const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            //         for (let k = 0; k < myClients.length; k++) {
            //             if (myClients[k].user.role === "admin")
            //                 myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
            //             else
            //                 myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            //         }
            //         return;
            //     }
            // }

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("SELL_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.estimateSwapAmountOut = async (req, res) => {
    const { projectId, amountIn, address, slippage, path } = req.body;
    console.log("swapping tokens...", amountIn, address, slippage, path);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        const projectWallet = project.wallets.find(_v => _v.address == address);
        if (!projectWallet) {
            console.log("Invalid Project Wallet!");
            res.status(401).json({
                success: false,
                error: "Unaccessable wallet",
            });
            return;
        }

        const walletItem = await Wallet.findOne({ address: address });
        console.log(project.name, address, "found wallet item");

        const { connection } = useConnection();
        const tokenAddress1 = path[0];
        const tokenAddress2 = path[1];

        let token;

        if (tokenAddress1 == "So11111111111111111111111111111111111111112")
            token = tokenAddress2;
        else
            token = tokenAddress1

        const mint = new PublicKey(token);

        const mintInfo = await getMint(connection, mint);
        const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
        const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
        const slippagePercent = new Percent(slippage, 100);

        const poolInfo = await getPoolInfo(connection, token)

        const poolKeys = jsonInfo2PoolKeys(poolInfo);
        const zero = new BN(0);

        const baseAmount = new TokenAmount(baseToken, new BN(amountIn));
        const quoteAmount = new TokenAmount(quoteToken, new BN(amountIn));
        const { minAmountOut: minQuoteAmount, amountOut } = token == tokenAddress1 ?
            Liquidity.computeAmountOut({
                poolKeys: poolKeys,
                poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                amountIn: baseAmount,
                currencyOut: quoteToken,
                slippage: slippagePercent,
            }) :
            Liquidity.computeAmountOut({
                poolKeys: poolKeys,
                poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                amountIn: quoteAmount,
                currencyOut: baseToken,
                slippage: slippagePercent,
            });

        console.log(amountOut.raw.toString())
        res.status(200).json({
            success: true,
            value: amountOut.raw.toString()
        })
        return;
    } catch (error) {
        console.log(error)
        res.status(401).json({
            success: false,
            value: "Unknown error",
        })
        return;
    }
}

exports.add100Wallets = async (req, res) => {
    const { projectId } = req.body;
    console.log("Adding 100 wallets...", req.user.name, projectId);

    try {
        const project = await Project.findById(projectId);
        if (
            req.user.role !== "admin" &&
            project.userId !== req.user._id.toString()
        ) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }
        if (project.wallets.length >= 100) {
            res.status(200).json({
                success: false,
                error: "Already created 100 wallets",
            });
            return;
        }
        console.log(project.wallets.length)

        if (PAYMENT_OPTIONS[project.paymentId]?.walletLimit < 100) {
            res.status(201).json({
                success: false,
                error: "This project is limited to 10 wallets.",
            });
            return;
        }

        const createdWallets = await createWallets(project._id, 100 - project.wallets.length)
        for (let i = 0; i < createdWallets.length; i++) {
            console.log(i)
            project.wallets = [
                ...project.wallets,
                {
                    address: createdWallets[i].address,
                    initialTokenAmount: "",
                    sim: {
                        disperseAmount: "",
                        buy: {
                            tokenAmount: "",
                            solAmount: ""
                        },
                        xfer: {
                            fromAddress: "",
                            tokenAmount: ""
                        }
                    },
                },
            ];
        }
        await project.save()
        console.log("Success!...")
        res.status(200).json({
            success: true,
            project: {
                _id: project._id.toString(),
                name: project.name,
                token: project.token,
                platform: project.platform,
                enableMode: project.enableMode,
                antiDrainer: project.antiDrainer,
                zombie: project.zombie,
                wallets: project.wallets,
                additionalWallets: project.additionalWallets,
                teamWallets: project.teamWallets,
                extraWallets: project.extraWallets,
                status: project.status,
                depositWallet: project.depositWallet,
                userId: project.userId,
                userName: project.userName,
            }
        });
    } catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.swapToken = async (req, res) => {
    const { projectId, poolInfo: initialPoolInfo, address, amountIn, slippage, path } = req.body;
    console.log("swapping tokens...", path, amountIn);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        const projectWallet = project.wallets.find(_v => _v.address == address);
        if (!projectWallet) {
            console.log("Invalid Project Wallet!");
            res.status(401).json({
                success: false,
                error: "Unaccessable wallet",
            });
            return;
        }

        const walletItem = await Wallet.findOne({ address: address });
        console.log(project.name, address, "found wallet item");

        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const tokenAddress1 = path[0];
            const tokenAddress2 = path[1];

            let token;

            if (tokenAddress1 == "So11111111111111111111111111111111111111112")
                token = tokenAddress2;
            else
                token = tokenAddress1


            let poolInfo = initialPoolInfo;
            if (poolInfo == undefined || (poolInfo.baseMint && poolInfo.baseMint !== token)) {
                poolInfo = await getPoolInfo(connection, token);
            }

            const mint = new PublicKey(token);
            const mintInfo = await getMint(connection, mint);
            const baseToken = new Token(TOKEN_PROGRAM_ID, mint, mintInfo.decimals);
            const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
            const slippagePercent = new Percent(slippage, 100);

            const poolKeys = jsonInfo2PoolKeys(poolInfo);
            const zero = new BN(0);

            const USE_JITO = true;

            const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
            const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey)
            let tokenAccountInfo = null;
            if (token == tokenAddress1) {
                try {
                    tokenAccountInfo = await getAccount(connection, associatedToken);

                    const tokenBalance = new BN(tokenAccountInfo.amount);
                    if (tokenBalance.lt(zero)) {
                        res.status(401).json({
                            success: false,
                            error: "Invalid token balance",
                        });
                        return;
                    }
                } catch (err) {
                    console.log(err);
                    res.status(401).json({
                        success: false,
                        error: "Invalid token balance",
                    });
                    return;
                }
            }

            let walletTokenAccount = null;
            try {
                walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
            } catch (err) {
                console.log(err);
                res.status(401).json({
                    success: false,
                    error: "Invalid sol balance",
                });
                return;
            }

            if (USE_JITO) {
                const solBalance = new BN(await connection.getBalance(account.publicKey));
                if (solBalance.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                    console.log("Insufficient SOL!", account.publicKey.toBase58());
                    res.status(401).json({
                        success: false,
                        error: "Insufficient sol balance",
                    });
                    return;
                }

                if (poolInfo && Object.keys(poolInfo).length > 0) {
                    try {
                        const baseAmount = new TokenAmount(baseToken, amountIn, false);
                        const quoteAmount = new TokenAmount(quoteToken, amountIn, false);
                        // const minOutAmount = new TokenAmount(token == tokenAddress1 ? quoteToken : baseToken, new BN("1"));

                        let mode
                        if (token == tokenAddress1)
                            mode = "sell"
                        else
                            mode = "buy"
                        const { minAmountOut } = await estimateOutputAmout(connection, poolInfo, mode, amountIn, slippage);

                        const minAmountOutRaw = minAmountOut.raw.toString()

                        const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                            connection,
                            poolKeys,
                            userKeys: {
                                tokenAccounts: walletTokenAccount,
                                owner: account.publicKey,
                            },
                            amountIn: token == tokenAddress1 ? baseAmount : quoteAmount,
                            amountOut: token == tokenAddress1 ? new TokenAmount(quoteToken, new BN(minAmountOutRaw), true) : new TokenAmount(baseToken, new BN(minAmountOutRaw), true),
                            fixedSide: 'in',
                            makeTxVersion: TxVersion.V0,
                        });

                        let newInnerTransactions = [...innerTransactions];
                        if (newInnerTransactions.length > 0) {
                            const p = newInnerTransactions.length - 1;

                            let taxSolAmount = 0;
                            if (mode == "buy") {
                                taxSolAmount = (BigInt(new BigNumber((parseFloat(amountIn) * parseFloat(process.env.SWAP_TAX)).toFixed(9) + 'e9').toString()) / BigInt(100)).toString();
                            } else {
                                taxSolAmount = parseFloat(new BN(minAmountOutRaw).muln(parseFloat(process.env.SWAP_TAX)).divn(100).toString()).toFixed(0);
                            }
                            newInnerTransactions[p].instructionTypes = [
                                50, 4,
                                ...newInnerTransactions[p].instructionTypes,
                            ];
                            newInnerTransactions[p].instructions = [
                                CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * jitoTip),
                                SystemProgram.transfer({
                                    fromPubkey: account.publicKey,
                                    toPubkey: new PublicKey(getTaxWallet()),
                                    lamports: taxSolAmount.toString(),
                                }),
                                ...newInnerTransactions[p].instructions,
                            ];
                        }

                        const verTxns = await buildSimpleTransaction({
                            connection: connection,
                            makeTxVersion: TxVersion.V0,
                            payer: account.publicKey,
                            innerTransactions: newInnerTransactions,
                        });

                        for (let j = 0; j < verTxns.length; j++)
                            verTxns[j].sign([account]);

                        const ret = await buildBundleOnNB(verTxns);
                        res.status(200).json({
                            success: ret,
                            message: "Bundle",
                        });
                        return;
                    } catch (err) {
                        console.log(err)
                        res.status(401).json({
                            success: false,
                            error: "error",
                        });
                        return;
                    }
                } else {
                    try {
                        const provider = new anchor.AnchorProvider(
                            connection,
                            new anchor.Wallet(account),
                            anchor.AnchorProvider.defaultOptions()
                        )

                        // const program = new anchor.Program(idl, programID, provider);
                        const program = getPumpProgram(connection, new PublicKey(programID));
                        let tradingTx;
                        if (token == tokenAddress2) {
                            tradingTx = await buildBuyTx(
                                program,
                                connection,
                                account,
                                token,
                                amountIn,
                                9999,
                                0
                            )
                        } else {
                            tradingTx = await buildSellTx(
                                program,
                                connection,
                                account,
                                token,
                                0,
                                amountIn
                            )
                        }
                        let newInnerTransactions = [...tradingTx.instructions];
                        newInnerTransactions.push(
                            CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * jitoTip)
                        )

                        const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;

                        const transactionMessage = new TransactionMessage({
                            payerKey: account.publicKey,
                            instructions: newInnerTransactions,
                            recentBlockhash
                        })
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign([account]);
                        const ret = await buildBundleOnNB([tx]);
                        res.status(200).json({
                            success: ret,
                            message: "Bundle",
                        });
                        return;
                    } catch (err) {
                        console.log(err);
                        res.status(401).json({
                            success: false,
                            error: "error",
                        });
                        return;
                    }
                }
            } else {
                const baseAmount = new TokenAmount(baseToken, new BN(amountIn));
                const quoteAmount = new TokenAmount(quoteToken, new BN(amountIn));
                const { minAmountOut: minQuoteAmount } = token == tokenAddress1 ?
                    Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                        amountIn: baseAmount,
                        currencyOut: quoteToken,
                        slippage: slippagePercent,
                    }) :
                    Liquidity.computeAmountOut({
                        poolKeys: poolKeys,
                        poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                        amountIn: quoteAmount,
                        currencyOut: baseToken,
                        slippage: slippagePercent,
                    });

                const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                    connection,
                    poolKeys,
                    userKeys: {
                        tokenAccounts: walletTokenAccount,
                        owner: account.publicKey,
                    },
                    amountIn: token == tokenAddress1 ? baseAmount : quoteAmount,
                    amountOut: minQuoteAmount,
                    fixedSide: token == tokenAddress1 ? 'in' : 'out',
                    makeTxVersion: TxVersion.V0,
                });

                const transactions = await buildSimpleTransaction({
                    connection: connection,
                    makeTxVersion: TxVersion.V0,
                    payer: account.publicKey,
                    innerTransactions: innerTransactions
                });

                for (let j = 0; j < transactions.length; j++)
                    transactions[j].sign([account]);

                const ret = await sendAndConfirmVersionedTransactions(connection, transactions);
                res.status(200).json({
                    success: ret,
                    message: "Normal",
                });
                return;
            }
        }
        catch (err) {
            console.log(err);
            res.status(401).json({
                success: false,
                error: "Unknown error",
            });
            return
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.transferTokens = async (req, res) => {
    const { projectId, token, wallets, teamWallets } = req.body;
    console.log("Transferring tokens...", projectId, token, wallets, teamWallets);
    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        res.status(200).json({
            success: true
        });

        const clients = getWebSocketClientList();
        const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
        try {
            const jitoTip = req.user.presets.jitoTip;
            console.log("Jito Tip:", jitoTip);

            const { connection } = useConnection();
            const mint = new PublicKey(token);
            const mintInfo = await getMint(connection, mint);

            const USE_JITO = true;
            const tWallets = [
                ...teamWallets,
                ...wallets,
            ];
            if (USE_JITO) {
                let bundleItems = [];
                let bundleIndex = -1;
                let index = 0;
                while (index < tWallets.length) {
                    let payer = null;
                    let signers = [];

                    let count = 0;
                    let instructions = [];
                    for (let i = index; i < tWallets.length; i++) {
                        const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                        const fromAccount = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                        const fromTokenAccount = getAssociatedTokenAddressSync(mint, fromAccount.publicKey);
                        if (!fromTokenAccount)
                            continue;

                        if (count === 0) {
                            payer = fromAccount.publicKey;

                            const balanceSol = new BN(await connection.getBalance(payer));
                            if (balanceSol.lte(new BN(LAMPORTS_PER_SOL * jitoTip))) {
                                console.log("Insufficient SOL!", payer.toBase58());
                                for (let k = 0; k < myClients.length; k++)
                                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                                return;
                            }
                        }

                        signers = [
                            ...signers,
                            fromAccount,
                        ];

                        const toPublicKey = new PublicKey(tWallets[i].receipent);
                        const toTokenAccount = getAssociatedTokenAddressSync(mint, toPublicKey);
                        const tokenAmount = new BigNumber(tWallets[i].amount + "e" + mintInfo.decimals.toString()).toFixed(0);
                        try {
                            const info = await connection.getAccountInfo(toTokenAccount);
                            if (!info) {
                                instructions.push(
                                    createAssociatedTokenAccountInstruction(
                                        fromAccount.publicKey,
                                        toTokenAccount,
                                        toPublicKey,
                                        mint
                                    )
                                );
                            }
                        }
                        catch (err) {
                            console.log(err);
                        }

                        instructions.push(
                            createTransferInstruction(
                                fromTokenAccount,
                                toTokenAccount,
                                fromAccount.publicKey,
                                tokenAmount
                            )
                        );

                        count++;
                        if (count === 5)
                            break;
                    }

                    if (instructions.length > 0) {
                        if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                            bundleItems[bundleIndex].push({
                                instructions: instructions,
                                signers: signers,
                                payer: payer,
                            });
                        }
                        else {
                            bundleItems.push([
                                {
                                    instructions: instructions,
                                    signers: signers,
                                    payer: payer,
                                }
                            ]);
                            bundleIndex++;
                        }
                    }
                    else
                        break;

                    index += count;
                }

                console.log("Bundle Items:", bundleItems.length);
                let bundleTxns = [];
                const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                for (let i = 0; i < bundleItems.length; i++) {
                    const bundleItem = bundleItems[i];
                    console.log("Bundle", i, bundleItem.length);
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        if (j === bundleItem.length - 1) {
                            bundleItem[j].instructions.push(
                                CreateTraderAPITipInstruction(bundleItem[j].payer, LAMPORTS_PER_SOL * jitoTip)
                            );
                        }
                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: bundleItem[j].instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(bundleItem[j].signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }

                const ret = await buildBundlesOnNB(bundleTxns);
                if (!ret) {
                    console.log("Failed to transfer tokens");
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                let transactions = [];
                for (let i = 0; i < tWallets.length; i++) {
                    const walletItem = await Wallet.findOne({ address: tWallets[i].address });
                    const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));
                    const fromTokenAccount = getAssociatedTokenAddressSync(mint, account.publicKey);
                    if (!fromTokenAccount)
                        continue;

                    const to = new PublicKey(tWallets[i].receipent);
                    const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, account, mint, to);
                    const tokenAmount = new BigNumber(tWallets[i].amount + "e" + mintInfo.decimals.toString()).toFixed(0);
                    const tx = new Transaction().add(
                        createTransferInstruction(
                            fromTokenAccount,
                            toTokenAccount.address,
                            account.publicKey,
                            tokenAmount)
                    );

                    transactions = [
                        ...transactions,
                        {
                            transaction: tx,
                            signers: [account],
                        }
                    ];
                }

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret) {
                        console.log("Failed to transfer tokens...");
                        for (let k = 0; k < myClients.length; k++)
                            myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed" }));
                        return;
                    }
                }
            }

            console.log("Success");

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "OK", project: project }));
                else
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "OK", project: projectForUser }));
            }
        }
        catch (err) {
            logToClients(myClients, err, true);

            const projectForUser = await Project.findById(projectId, { teamWallets: 0 });
            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed", project: project }));
                else
                    myClients[k].emit("TRANSFER_COMPLETED", JSON.stringify({ message: "Failed", project: projectForUser }));
            }
        }
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.collectAllFee = async (req, res) => {
    const { targetWallet } = req.body;
    console.log("Collecting all fee...", targetWallet);
    if (!targetWallet) {
        res.status(404).json({
            success: false,
        });
        return;
    }

    res.status(200).json({
        success: true
    });

    const clients = getWebSocketClientList();
    const myClients = clients.filter(item => item.user._id.toString() === req.user._id.toString());
    try {
        const { connection } = useConnection();
        const jitoTip = req.user.presets.jitoTip;
        const toPubkey = new PublicKey(targetWallet);
        const fee = new BN("1000000");
        const tip = new BN(LAMPORTS_PER_SOL * jitoTip);

        const walletItems = await Wallet.find({ userId: "admin", category: "temporary" });
        const USE_JITO = true;
        if (USE_JITO) {
            let accounts = {};
            for (let i = 0; i < walletItems.length; i++)
                accounts[walletItems[i].address] = Keypair.fromSecretKey(bs58.decode(walletItems[i].privateKey));

            let bundleIndex = -1;
            let bundleItems = [];
            let index = 0;
            while (index < walletItems.length) {
                let xfers = [];
                let payer;
                let count = 0;
                while (index < walletItems.length) {
                    if (accounts[walletItems[index].address]) {
                        const balance = new BN((await connection.getBalance(accounts[walletItems[index].address].publicKey)).toString());
                        if (balance.gt(fee)) {
                            xfers.push({
                                keypair: accounts[walletItems[index].address],
                                fromPubkey: accounts[walletItems[index].address].publicKey,
                                toPubkey: toPubkey,
                                lamports: balance.sub(fee),
                            });
                            if (count === 0)
                                payer = accounts[walletItems[index].address].publicKey;
                            count++;
                        }
                    }
                    index++;
                    if (count >= 5)
                        break;
                }

                if (xfers.length > 0) {
                    console.log(`Transfer Instructions(${index - count}-${index - 1}):`, xfers.length);
                    if (bundleItems[bundleIndex] && bundleItems[bundleIndex].length < BUNDLE_TX_LIMIT) {
                        bundleItems[bundleIndex].push({
                            xfers,
                            payer,
                        });
                    }
                    else {
                        bundleItems.push([
                            {
                                xfers,
                                payer,
                            }
                        ]);
                        bundleIndex++;
                    }
                }
            }

            console.log("Bundle Items:", bundleItems.length);
            let bundleTxns = [];
            const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            for (let i = 0; i < bundleItems.length; i++) {
                const bundleItem = bundleItems[i];
                // console.log("Bundle", i, bundleItem);
                let tipPayer = null;
                for (let j = 0; j < bundleItem.length; j++) {
                    for (let k = 0; k < bundleItem[j].xfers.length; k++) {
                        if (bundleItem[j].xfers[k].lamports.gte(tip)) {
                            tipPayer = bundleItem[j].xfers[k].keypair;
                            bundleItem[j].xfers[k].lamports = bundleItem[j].xfers[k].lamports.sub(tip);
                            break;
                        }
                    }
                    if (tipPayer)
                        break;
                }

                if (tipPayer) {
                    let verTxns = [];
                    for (let j = 0; j < bundleItem.length; j++) {
                        let instructions = bundleItem[j].xfers.map(item => {
                            return SystemProgram.transfer({
                                fromPubkey: item.fromPubkey,
                                toPubkey: item.toPubkey,
                                lamports: item.lamports.toString(),
                            });
                        });
                        let signers = bundleItem[j].xfers.map(item => item.keypair);
                        if (j === bundleItem.length - 1) {
                            instructions = [
                                CreateTraderAPITipInstruction(tipPayer.publicKey, LAMPORTS_PER_SOL * jitoTip),
                                ...instructions,
                            ];
                            signers = [
                                tipPayer,
                                ...signers,
                            ];
                        }

                        const transactionMessage = new TransactionMessage({
                            payerKey: bundleItem[j].payer,
                            instructions: instructions,
                            recentBlockhash,
                        });
                        const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                        tx.sign(signers);
                        verTxns.push(tx);
                    }

                    bundleTxns.push(verTxns);
                }
            }

            const ret = await buildBundlesOnNB(bundleTxns);
            if (!ret) {
                logToClients(myClients, "Failed to collect all fee", false);
                for (let k = 0; k < myClients.length; k++)
                    myClients[k].emit("COLLECT_ALL_FEE", JSON.stringify({ message: "Failed" }));
                return;
            }
        }
        else {
            let transactions = [];
            for (let i = 0; i < walletItems.length; i++) {
                const keypair = Keypair.fromSecretKey(bs58.decode(walletItems[i].privateKey));
                const balance = new BN((await connection.getBalance(keypair.publicKey)).toString());
                if (balance.gte(fee)) {
                    const tx = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: keypair.publicKey,
                            toPubkey: toPubkey,
                            lamports: balance.sub(fee).toString(),
                        })
                    );

                    transactions = [
                        ...transactions,
                        {
                            transaction: tx,
                            signers: [keypair],
                        }
                    ];
                }
            }

            if (transactions.length > 0) {
                const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                if (!ret)
                    console.log("Failed to collect all fee");
            }
        }
        console.log("Success");

        for (let k = 0; k < myClients.length; k++)
            myClients[k].emit("COLLECT_ALL_FEE", JSON.stringify({ message: "OK" }));
    }
    catch (err) {
        logToClients(myClients, err, true);
        for (let k = 0; k < myClients.length; k++)
            myClients[k].emit("COLLECT_ALL_FEE", JSON.stringify({ message: "Failed" }));
    }
}

exports.addAdditionalWallets = async (req, res) => {
    const { projectId, address } = req.body;
    console.log("Adding additional wallets...", projectId);

    try {
        const project = await Project.findById(projectId);
        if (req.user.role !== "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        let flg = false
        project.additionalWallets.map((_w) => {
            if (_w.address === address) {
                flg = true;
            }
        })
        if (flg) {
            res.status(400).json({
                success: false,
                error: "This address already exists.",
            });
            return;
        }
        project.additionalWallets = [
            ...project.additionalWallets,
            {
                address,
                initialTokenAmount: "",
                sim: {
                    disperseAmount: "",
                    buy: {
                        tokenAmount: "",
                        solAmount: ""
                    },
                    xfer: {
                        fromAddress: "",
                        tokenAmount: ""
                    }
                },

            },
        ]
        await project.save()
        res.status(200).json({
            success: true,
            project: {
                _id: project._id.toString(),
                name: project.name,
                token: project.token,
                platform: project.platform,
                template: project.template,
                enableMode: project.enableMode,
                antiDrainer: project.antiDrainer,
                zombie: project.zombie,
                wallets: project.wallets,
                additionalWallets: project.additionalWallets,
                status: project.status,
                depositWallet: project.depositWallet,
                userId: project.userId,
                userName: project.userName,
            }
        });
    } catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.removeAdditionalWallets = async (req, res) => {
    const { projectId, address } = req.body;
    console.log("Adding additional wallets...", projectId);

    try {
        const project = await Project.findById(projectId);
        if (req.user.role != "admin" && project.userId !== req.user._id.toString()) {
            console.log("Mismatched user id!");
            res.status(401).json({
                success: false,
                error: "User ID mismatch",
            });
            return;
        }

        let flg = false;
        let index = 0;
        project.additionalWallets.map((_w, _i) => {
            if (_w.address === address) {
                flg = true;
                index = _i;
            }
        })
        if (!flg) {
            res.status(400).json({
                success: false,
                error: "This address is not exists.",
            });
            return;
        }
        project.additionalWallets.splice(index, 1);
        await project.save()
        res.status(200).json({
            success: true,
            project: {
                _id: project._id.toString(),
                name: project.name,
                token: project.token,
                platform: project.platform,
                template: project.template,
                enableMode: project.enableMode,
                antiDrainer: project.antiDrainer,
                zombie: project.zombie,
                wallets: project.wallets,
                additionalWallets: project.additionalWallets,
                status: project.status,
                depositWallet: project.depositWallet,
                userId: project.userId,
                userName: project.userName,
            }
        });
    } catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Unknown error",
        });
    }
}

exports.handleLimitSwap = async (req, res) => {
    const { projectId, address, amountIn, amountOutMin, path, targetIndex, targetPrice, targetUnit, isBigger, expiry } = req.body;
    if (amountIn < 0 || amountOutMin < 0) {
        res.status(409).json({
            success: false,
            value: "amount is not valid",
        })
        return;
    }
    let currentTime = new Date().getTime();
    let expiryPeriod = parseInt(expiry) * 24 * 3600 * 1000;
    const new_order = await LimitOrder.create({
        projectid: projectId,
        address: address,
        amountin: amountIn,
        amountoutmin: amountOutMin,
        from: path[0],
        to: path[1],
        targetunit: targetUnit,
        targetindex: targetIndex,
        targetprice: targetPrice,
        isbigger: isBigger,
        expiry: currentTime + expiryPeriod,
        expired: false
    })
    limitSwap(new_order)
    res.status(200).json({
        success: true,
        error: "Limit order placed",
    });
    return;
}

const limitSwap = async (order) => {
    console.log("start limit order daemon....")
    const {
        projectid,
        address,
        amountin,
        amountoutmin,
        from,
        to,
        targetindex,
        targetprice,
        isbigger,
        targetunit,
        expiry
    } = order;

    let currentTime = new Date().getTime();
    if (currentTime >= parseInt(expiry)) {
        order.expired = true;
        order.save();
        return;
    }

    console.log(projectid);

    const project = await Project.findById(projectid);
    if (!project) {
        console.log("Mismatched project id!");
        return;
    }

    const user = await User.findById(project.userId);
    const jitoTip = user.presets.jitoTip;

    const walletItem = await Wallet.findOne({
        address: address,
    });
    const tokenAddress1 = from;
    const tokenAddress2 = to;

    let token;

    if (tokenAddress1 == "So11111111111111111111111111111111111111112")
        token = tokenAddress2;
    else
        token = tokenAddress1

    const { connection } = useConnection()

    const mint = new PublicKey(token);

    const mintInfo = await getMint(connection, mint);
    const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");
    const slippagePercent = new Percent(10, 100);

    let mode
    if (token == tokenAddress1) {
        mode = "sell"
    } else {
        mode = "buy"
    }

    let price_check_mode = targetindex == 0 ? mode : mode == 'sell' ? 'buy' : 'sell';

    const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));

    let walletTokenAccount = null;
    try {
        walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
    } catch (err) {
        console.log(err);
        return;
    }

    const poolInfo = await getPoolInfo(connection, token)

    const poolKeys = jsonInfo2PoolKeys(poolInfo);

    const baseAmount = new TokenAmount(baseToken, parseFloat(amountin), false);
    const quoteAmount = new TokenAmount(quoteToken, parseFloat(amountin), false);

    const interval = setInterval(async () => {
        try {
            const { amountOut, minAmountOut } = await estimateOutputAmout(connection, poolInfo, price_check_mode, 1);

            const priceUnit = amountOut.raw.toString();

            let flag = false
            if (isbigger && Number(priceUnit) >= Number(targetprice) || !isbigger && Number(priceUnit) <= Number(targetprice)) {
                flag = true;
            } else {
                flag = false;
            }

            console.log("target: ", targetprice, "current: ", priceUnit.toString());

            if (flag) {
                clearInterval(interval)

                const { minAmountOut, amountOut } = await estimateOutputAmout(connection, poolInfo, mode, parseFloat(amountin));

                const minAmountOutRaw = minAmountOut.raw.toString();

                const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                    connection,
                    poolKeys,
                    userKeys: {
                        tokenAccounts: walletTokenAccount,
                        owner: account.publicKey,
                    },
                    amountIn: token == tokenAddress1 ? baseAmount : quoteAmount,
                    amountOut: token == tokenAddress1 ? new TokenAmount(quoteToken, new BN(minAmountOutRaw)) : new TokenAmount(baseToken, new BN(minAmountOutRaw)),
                    fixedSide: 'in',
                    makeTxVersion: TxVersion.V0,
                });

                let newInnerTransactions = [...innerTransactions];
                if (newInnerTransactions.length > 0) {
                    const p = newInnerTransactions.length - 1;
                    newInnerTransactions[p].instructionTypes = [
                        50,
                        ...newInnerTransactions[p].instructionTypes,
                    ];
                    newInnerTransactions[p].instructions = [
                        CreateTraderAPITipInstruction(account.publicKey, jitoTip * LAMPORTS_PER_SOL),
                        ...newInnerTransactions[p].instructions,
                    ];

                    let taxSolAmount = 0;
                    if (mode == "buy") {
                        taxSolAmount = (BigInt(new BigNumber((parseFloat(amountin) * parseFloat(process.env.SWAP_TAX)).toFixed(9) + 'e9').toString()) / BigInt(100)).toString();
                    } else {
                        taxSolAmount = parseFloat(new BN(minAmountOutRaw).muln(parseFloat(process.env.SWAP_TAX)).divn(100).toString()).toFixed(0);
                    }

                    newInnerTransactions[p].instructionTypes = [
                        50,
                        ...newInnerTransactions[p].instructionTypes,
                    ];
                    newInnerTransactions[p].instructions = [
                        SystemProgram.transfer({
                            fromPubkey: account.publicKey,
                            toPubkey: new PublicKey(getTaxWallet()),
                            lamports: taxSolAmount
                        }),
                        ...newInnerTransactions[p].instructions
                    ];
                }

                const verTxns = await buildSimpleTransaction({
                    connection: connection,
                    makeTxVersion: TxVersion.V0,
                    payer: account.publicKey,
                    innerTransactions: newInnerTransactions,
                });

                for (let j = 0; j < verTxns.length; j++)
                    verTxns[j].sign([account]);

                const ret = await buildBundleOnNB(verTxns);
                if (ret)
                    await LimitOrder.findOneAndUpdate({ _id: order._id }, { expired: true })
                return;
            }
        } catch (error) {
            console.log(error);
            return;
        }
    }, [5000])

    await sleep(expiry - currentTime);
    await LimitOrder.findOneAndUpdate({ _id: order._id }, { expired: true })
    clearInterval(interval)
}

const sellAllTokensFromExtraWallet = async (project, providedPoolInfo, token) => {
    const { connection } = useConnection();
    const mint = new PublicKey(token);
    const mintInfo = await getMint(connection, mint);
    const baseToken = new Token(TOKEN_PROGRAM_ID, token, mintInfo.decimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, "So11111111111111111111111111111111111111112", 9, "WSOL", "WSOL");

    let poolInfo = providedPoolInfo;
    if (providedPoolInfo == undefined || (providedPoolInfo.baseMint && providedPoolInfo.baseMint !== token)) {
        poolInfo = await getPoolInfo(connection, token);
    }

    const poolKeys = jsonInfo2PoolKeys(poolInfo);

    const extraWallets = project.extraWallets
    let pendingBundleResponse = [];
    let jito_tx_count = 0;
    let allVerTxns = [];
    for (let i = 0; i < extraWallets.length; i++) {
        try {
            const extraItem = await Wallet.findOne({ address: extraWallets[i].address });
            const account = Keypair.fromSecretKey(bs58.decode(extraItem.privateKey));
            const associatedToken = getAssociatedTokenAddressSync(mint, account.publicKey);
            let tokenBalance;
            let tokenAccountInfo = null;
            try {
                tokenAccountInfo = await getAccount(connection, associatedToken);
                tokenBalance = new BN(tokenAccountInfo.amount);
                let formattedBalance = new BigNumber(tokenAccountInfo.amount.toString() + 'e-' + mintInfo.decimals.toString()).toString();
                extraWallets[i].amount = formattedBalance;
            } catch (err) {
                console.log(err);
                continue;
            }

            let walletTokenAccount = null;
            try {
                walletTokenAccount = await getWalletTokenAccount(connection, account.publicKey);
            }
            catch (err) {
                console.log(err);
                continue;
            }

            if (poolInfo && Object.keys(poolInfo).length > 0) {
                try {
                    console.log("Selling token from", extraWallets[i].address);
                    // const tokenAmount = new BigNumber(extraWallets[i].amount).multipliedBy(mode == 'sell' ? new BigNumber('1e' + baseToken.decimals.toString()) : new BigNumber('1e9'));
                    const baseAmount = new TokenAmount(baseToken, extraWallets[i].amount, false);

                    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                        connection,
                        poolKeys,
                        userKeys: {
                            tokenAccounts: walletTokenAccount,
                            owner: account.publicKey,
                        },
                        amountIn: baseAmount,
                        amountOut: new TokenAmount(quoteToken, new BN(1)),
                        fixedSide: 'in',
                        makeTxVersion: TxVersion.V0,
                    });

                    /* Add Tip Instruction */
                    let newInnerTransactions = [...innerTransactions];
                    if (newInnerTransactions.length > 0) {
                        const p = newInnerTransactions.length - 1;

                        if (jito_tx_count == 0) {
                            newInnerTransactions[p].instructionTypes = [
                                50,
                                ...newInnerTransactions[p].instructionTypes,
                            ];
                            newInnerTransactions[p].instructions = [
                                CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * 0.001),
                                ...newInnerTransactions[p].instructions,
                            ];
                        }
                    }

                    const verTxns = await buildSimpleTransaction({
                        connection: connection,
                        makeTxVersion: TxVersion.V0,
                        payer: account.publicKey,
                        innerTransactions: newInnerTransactions,
                    });

                    for (let j = 0; j < verTxns.length; j++) {
                        // console.log(await connection.simulateTransaction(verTxns[j]))
                        verTxns[j].sign([account]);
                    }

                    jito_tx_count++;
                    if (jito_tx_count == BUNDLE_TX_LIMIT || i == extraWallets.length - 1) {
                        allVerTxns = [...allVerTxns, ...verTxns];
                        console.log(allVerTxns.length);
                        allVerTxns.map((v) => console.log(v.serialize().length))
                        const ret = buildBundleOnNB(allVerTxns);
                        pendingBundleResponse = [
                            ...pendingBundleResponse,
                            ret,
                        ];

                        jito_tx_count = 0;
                        allVerTxns = []
                    } else {
                        allVerTxns = [...allVerTxns, ...verTxns];
                    }
                } catch (err) {
                    console.log(err);
                    continue;
                }
            } else {
                const provider = new anchor.AnchorProvider(
                    connection,
                    new anchor.Wallet(account),
                    anchor.AnchorProvider.defaultOptions()
                )

                // const program = new anchor.Program(idl, programID, provider);
                const program = getPumpProgram(connection, new PublicKey(programID));
                let tradingTx;
                const maxTokenAmount = parseFloat(new BigNumber(tokenBalance.toString() + 'e-' + mintInfo.decimals.toString()).toString());
                const amountIn = maxTokenAmount > parseFloat(extraWallets[i].amount) ? extraWallets[i].amount : maxTokenAmount.toString()

                tradingTx = await buildSellTx(
                    program,
                    connection,
                    account,
                    token,
                    0,
                    amountIn
                )

                let newInnerTransactions = [...tradingTx.instructions];
                newInnerTransactions.push(
                    CreateTraderAPITipInstruction(account.publicKey, LAMPORTS_PER_SOL * 0.001)
                )

                const recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;

                const transactionMessage = new TransactionMessage({
                    payerKey: account.publicKey,
                    instructions: newInnerTransactions,
                    recentBlockhash
                })
                const tx = new VersionedTransaction(transactionMessage.compileToV0Message());
                tx.sign([account]);
                const ret = buildBundleOnNB([tx]);
                pendingBundleResponse = [
                    ...pendingBundleResponse,
                    ret
                ]
            }
        } catch (err) {
            console.log(err)
        }
    }
}

const initCallLimitSwap = async () => {
    const orders = await LimitOrder.find({ expired: false });
    orders && orders.length > 0 && orders.map((order) => {
        limitSwap(order)
    })
}

initCallLimitSwap()