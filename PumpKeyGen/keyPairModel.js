const mongoose = require('mongoose');

const pumpKeyPair = new mongoose.Schema({
    publicKey: String,
    privateKey: String,
    name: String,
    symbol: String,
    uri: String,
    isUsed: Boolean,
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