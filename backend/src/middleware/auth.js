const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Project = require("../models/projectModel");
const { isValidAddress, createWallets, decryptId } = require("../utils/common");
const { verifySignature } = require("../utils/auth");
const { DEFAULT_WALLET_AMOUNT } = require("../constants");

exports.isValidUser = async (req, res, next) => {
    try {
        const { signingData, sigData, inviteCode } = req.body;
        console.log("inviteCode", inviteCode, signingData)
        let parsedSigningData = signingData;
        let parsedSigData = sigData
        try {
            parsedSigningData = JSON.parse(signingData);
            parsedSigData = JSON.parse(sigData)
        } catch (err) {

        }

        if (!parsedSigningData || !parsedSigData) {
            console.log("No signature data");
            res.status(401).json({
                success: false,
                error: "Please add signature data"
            });
            return;
        }

        if (!isValidAddress(parsedSigningData?.address)) {
            console.log("Invalid signing data type");
            res.status(401).json({
                success: false,
                error: "No address provided"
            });
            return;
        }

        const ret = verifySignature(parsedSigningData, parsedSigData.data, parsedSigningData.address)
        if (!ret) {
            console.log("Invalid signature");
            res.status(401).json({
                success: false,
                error: "Invalid signature"
            });
            return;
        }

        req.user = await User.findOne({ name: parsedSigningData.address });
        if (!req.user) {
            let inviteUserId = "";
            if (inviteCode != "") {
                console.log(inviteCode)
                inviteUserId = decryptId(inviteCode);
            }
            const user = await User.create({
                name: parsedSigningData.address,
                password: "password",
                email: "example@gmail.com",
                role: "user",
                // code: crypto.randomBytes(8),
                code: Date.now(),
                referral: inviteUserId,
                privilege: false,
                confirmedEmail: true
            });
            req.user = await User.findOne({ name: parsedSigningData.address });

            const project = await Project.create({
                name: "Administrator Account",
                platform: "",
                token: {
                    address: "",
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
                teamWallets: [],
                extraWallets: [],
                status: "OPEN",
                depositWallet: {},
                userId: user._id.toString(),
                userName: user.name,
                paymentId: 0,
                timestamp: Date.now()
            });

            const createdWallets = await createWallets(project._id, DEFAULT_WALLET_AMOUNT)

            for (let i = 0; i < DEFAULT_WALLET_AMOUNT; i++) {
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

            await project.save();
        }

        next();
    }
    catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            error: "Please Login to Access"
        });
    }
};

exports.isAdminUser = async (req, res, next) => {
    try {
        if (req.user.role !== "admin") {
            res.status(404).json({
                success: false,
                error: "Invalid admin"
            });
            return;
        }

        next();
    }
    catch (err) {
        console.log(err);
        res.status(404).json({
            success: false,
            error: "Invalid admin"
        });
    }
};
