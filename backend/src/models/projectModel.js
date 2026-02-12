const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
    name: String,
    platform: String,
    token: {
        address: String,
        name: String,
        symbol: String,
        decimals: String,
        totalSupply: String,
        tokenUri: String,
        privateKey: String,
        creatorLpFeeShare: Boolean,
        authority: String,
        interval: Number,
        treasuries: [
            {
                address: String,
                percent: Number
            }
        ],
        customRpc: String,
        rewardCA: String,
    },
    poolInfo: {
        type: Object,
    },
    zombie: String,
    lookupTableAddress: String,
    wallets: [
        {
            address: String,
            initialTokenAmount: String,
            initialSolAmount: String,
            sim: {
                enabled: Boolean,
                disperseAmount: String,
                buy: {
                    tokenAmount: String,
                    solAmount: String,
                },
                xfer: {
                    fromAddress: String,
                    tokenAmount: String,
                }
            }
        }
    ],
    mirrorWallets: [
        {
            address: String,
        }
    ],
    additionalWallets: [
        {
            address: String,
            initialTokenAmount: String,
            initialSolAmount: String,
            sim: {
                disperseAmount: String,
                buy: {
                    tokenAmount: String,
                    solAmount: String,
                },
                xfer: {
                    fromAddress: String,
                    tokenAmount: String,
                }
            }
        }
    ],
    teamWallets: [
        {
            address: String,
            initialTokenAmount: String,
            sim: {
                disperseAmount: String,
                buy: {
                    tokenAmount: String,
                    solAmount: String,
                },
                xfer: {
                    fromAddress: String,
                    tokenAmount: String,
                }
            }
        }
    ],
    extraWallets: [
        {
            address: String,
            initialTokenAmount: String,
            sim: {
                disperseAmount: String,
                buy: {
                    tokenAmount: String,
                    solAmount: String,
                },
                xfer: {
                    fromAddress: String,
                    tokenAmount: String,
                }
            }
        }
    ],
    status: String,
    depositWallet: {
        address: String,
        expireTime: Date
    },
    userId: {
        type: String,
        required: [true, "Please Enter User Id"],
    },
    userName: String,
    paymentId: {
        type: Number,
        required: [true, "Please Enter Payment Id"],
    },
    initialTokenAmount: String,
    initialSolAmount: String,
    timestamp: {
        type: Number,
        default: Date.now
    }
});

module.exports = mongoose.model("Project", projectSchema);
