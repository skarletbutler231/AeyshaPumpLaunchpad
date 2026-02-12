const mongoose = require('mongoose');

const pumpKeyPair = new mongoose.Schema({
    publicKey: String,
    privateKey: String,
    isUsed: Boolean,
    name: String,
    symbol: String,
    uri: String,
});

exports.PumpKeyPair = mongoose.model("PumpKeyPair", pumpKeyPair);

const bonkKeyPair = new mongoose.Schema({
    publicKey: String,
    privateKey: String,
    isUsed: Boolean,
    name: String,
    symbol: String,
    uri: String,
    creatorLpFeeShare: Boolean,
});

exports.BonkKeyPair = mongoose.model("BonkKeyPair", bonkKeyPair);