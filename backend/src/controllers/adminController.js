const { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction, Transaction } = require("@solana/web3.js");
const { useConnection } = require("../utils/connection");
const { getWebSocketClientList } = require("../utils/websocket");
const { BN } = require("bn.js");
const { useJitoTipAddr, sendJitoBundle } = require("../utils/jito");
const Wallet = require("../models/walletModel");
const Preset = require("../models/presetModel");
const bs58 = require("bs58");
const { getRandomNumber, sendAndConfirmLegacyTransactions, isValidAddress } = require("../utils/common");
const { BUNDLE_TX_LIMIT } = require("../constants");
const { CreateTraderAPITipInstruction, buildBundlesOnNB } = require("../utils/astralane");

let taxWallet;

exports.collectAllSol = async (req, res) => {
    const { targetWallet, wallets } = req.body;
    console.log("Collecting all SOL...", targetWallet, wallets);
    try {
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
                    logToClients(myClients, "Failed to collect all SOL", false);
                    for (let k = 0; k < myClients.length; k++)
                        myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "Failed" }));
                    return;
                }
            }
            else {
                let transactions = [];
                for (let i = 0; i < wallets.length; i++) {
                    const walletItem = await Wallet.findOne({ address: wallets[i] });
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

                if (transactions.length > 0) {
                    const ret = await sendAndConfirmLegacyTransactions(connection, transactions);
                    if (!ret)
                        console.log("Failed to collect all SOL");
                }
            }
            console.log("Success");

            for (let k = 0; k < myClients.length; k++) {
                if (myClients[k].user.role === "admin")
                    myClients[k].emit("COLLECT_ALL_SOL", JSON.stringify({ message: "OK" }));
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

exports.initPreset = async () => {
    const taxWalletItem = await Preset.findOne({
        name: 'taxWallet'
    });
    if (!taxWalletItem) {
        await Preset.create({
            name: 'taxWallet',
            value: process.env.TAX_WALLET
        });
        taxWallet = process.env.TAX_WALLET;
    } else {
        taxWallet = taxWalletItem.value;
    }
}

exports.getTaxWallet = () => {
    return taxWallet;
}

exports.setTaxWallet = async (new_value) => {
    taxWallet = new_value;
    let taxWalletItem = await Preset.findOne({ name: "taxWallet" });
    taxWalletItem.value = new_value;
    await taxWalletItem.save();
}

exports.sendTaxWallet = async (req, res) => {
    if (req.user.role !== "admin") {
        console.log("Unprevilege account!");
        res.status(401).json({
            success: false,
            error: "Unprevilege account!",
        });
        return;
    }
    res.status(200).json({
        success: true,
        data: taxWallet
    })
}

exports.receiveTaxWallet = async (req, res) => {
    const { address } = req.body;
    if (req.user.role !== "admin") {
        console.log("Unprevilege account!");
        res.status(401).json({
            success: false,
            error: "Unprevilege account!",
        });
        return;
    }
    if (!isValidAddress(address)) {
        res.status(209).json({
            success: false,
            error: "Invalid wallet address!"
        })
        return;
    }
    await this.setTaxWallet(address);
    res.status(200).json({
        success: true
    })
}
