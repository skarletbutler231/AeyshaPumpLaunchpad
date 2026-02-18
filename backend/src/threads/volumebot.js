"use strict";

const bs58 = require("bs58");
const { Keypair, PublicKey, TransactionMessage, VersionedTransaction } = require("@solana/web3.js");
const {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const LAMPORTS_PER_SOL = 1e9;
const MIN_SOL_THRESHOLD = 0.01 * LAMPORTS_PER_SOL;
const POLL_INTERVAL_MS = 10_000;

const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Wallet = require("../models/walletModel");
const { useConnection } = require("../utils/connection");
const { getWebSocketClientList } = require("../utils/websocket");
const { buildBuyTxWithBuffer, buildSellTxBuffer, calcTokenAmounts } = require("../utils/pumpfun");
const { getPumpProgram } = require("@pump-fun/pump-sdk");
const { programID, BUNDLE_TX_LIMIT } = require("../constants/index");
const { CreateTraderAPITipInstruction, buildBundleOnNBAndConfirmTxId } = require("../utils/astralane");
const { sleep } = require("../utils/common");

const lastRunByProject = new Map();

function runVolumeBotLoop() {
    const { connection } = useConnection();
    if (!connection) return;
    const program = getPumpProgram(connection, new PublicKey(programID));

    setInterval(async () => {
        try {
            const projects = await Project.find({ "volumeBot.isRunning": true });

            for (const project of projects) {
                try {
                    const wallets = project.volumeBot?.wallets || [];
                    if (wallets.length === 0) continue;

                    const addresses = wallets.map((w) => w.address);
                    const balances = await Promise.all(
                        addresses.map((addr) =>
                            connection.getBalance(new PublicKey(addr)).catch(() => 0)
                        )
                    );

                    const allBelowThreshold = balances.every((b) => b < MIN_SOL_THRESHOLD);
                    if (allBelowThreshold) {
                        project.volumeBot.isRunning = false;
                        await project.save();
                        lastRunByProject.delete(project._id.toString());
                        const clients = getWebSocketClientList();
                        const myClients = clients.filter(
                            (c) => c.user && c.user._id.toString() === project.userId.toString()
                        );
                        const payload = JSON.stringify({
                            message: "All wallets below 0.01 SOL",
                            projectId: project._id.toString(),
                            project,
                        });
                        myClients.forEach((c) => c.emit("VOLUMEBOT_STOPPED", payload));
                        continue;
                    }

                    const periodMs = (project.volumeBot?.period || 60) * 1000;
                    const now = Date.now();
                    const lastRun = lastRunByProject.get(project._id.toString()) || 0;
                    if (now - lastRun < periodMs) continue;

                    const user = await User.findById(project.userId);
                    if (!user) continue;

                    const token = project.token;
                    const mint = new PublicKey(token.address);
                    const creatorPubkey = project.wallets?.[0]?.address
                        ? new PublicKey(project.wallets[0].address)
                        : mint;
                    const solAmounts = project.volumeBot.wallets.map((w, i) => {
                        const balanceSol = (balances[i] || 0) / LAMPORTS_PER_SOL;
                        const configuredAmount = parseFloat(w.amount) || 0;
                        const effectiveSol = configuredAmount * balanceSol / 100;
                        return effectiveSol;
                    });
                    let tokenAmountsForPumpfun;
                    try {
                        tokenAmountsForPumpfun = await calcTokenAmounts(connection, program, mint, solAmounts);
                    } catch (e) {
                        console.error("[volumebot] calcTokenAmounts failed", project._id, e);
                        continue;
                    }
                    
                    const txItems = [];
                    const jitoTip = (user.presets?.jitoTip ?? 0.0001) * LAMPORTS_PER_SOL;

                    for (let i = 0; i < project.volumeBot.wallets.length; i++) {
                        const walletItem = await Wallet.findOne({ address: project.volumeBot.wallets[i].address });
                        if (!walletItem) continue;
                        const account = Keypair.fromSecretKey(bs58.decode(walletItem.privateKey));

                        const buyTx = await buildBuyTxWithBuffer(
                            program,
                            connection,
                            account,
                            token.address,
                            solAmounts[i],
                            100,
                            tokenAmountsForPumpfun[i],
                            null,
                            project.isToken2022
                        );
                        const sellTx = await buildSellTxBuffer(
                            account,
                            mint,
                            0,
                            tokenAmountsForPumpfun[i],
                            creatorPubkey,
                            false,
                            project.isToken2022
                        );
                        txItems.push({
                            instructions: [...buyTx.instructions, ...sellTx.instructions],
                            signers: [account],
                        });
                    }

                    if (txItems.length === 0) continue;

                    for (let chunkStart = 0; chunkStart < txItems.length; chunkStart += BUNDLE_TX_LIMIT) {
                        const chunk = txItems.slice(chunkStart, chunkStart + BUNDLE_TX_LIMIT);
                        const lastIdx = chunk.length - 1;
                        chunk[lastIdx].instructions.push(
                            CreateTraderAPITipInstruction(chunk[lastIdx].signers[0].publicKey, jitoTip)
                        );
                    }

                    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
                    const bundleTxns = txItems.map((item) => {
                        const msg = new TransactionMessage({
                            payerKey: item.signers[0].publicKey,
                            instructions: item.instructions,
                            recentBlockhash: latestBlockhash.blockhash,
                        });
                        const tx = new VersionedTransaction(msg.compileToV0Message());
                        tx.sign(item.signers);
                        return tx;
                    });

                    for (let chunkStart = 0; chunkStart < bundleTxns.length; chunkStart += BUNDLE_TX_LIMIT) {
                        const chunk = bundleTxns.slice(chunkStart, chunkStart + BUNDLE_TX_LIMIT);
                        await buildBundleOnNBAndConfirmTxId(connection, chunk, "confirmed");
                        await sleep(300);
                    }
                    lastRunByProject.set(project._id.toString(), now);
                } catch (err) {
                    console.error("[volumebot] project", project._id, err);
                }
            }
        } catch (err) {
            console.error("[volumebot] loop error", err);
        }
    }, POLL_INTERVAL_MS);
}

exports.startVolumeBotThread = () => {
    runVolumeBotLoop();
    console.log("[volumebot] thread started");
};
