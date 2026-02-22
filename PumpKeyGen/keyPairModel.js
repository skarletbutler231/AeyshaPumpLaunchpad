const mongoose = require('mongoose');

const pumpKeyPairSchema = new mongoose.Schema({
    publicKey: String,
    privateKey: String,
    name: String,
    symbol: String,
    uri: String,
    isUsed: Boolean,
});

exports.pumpKeyPairSchema = pumpKeyPairSchema;
exports.PumpKeyPair = mongoose.model("PumpKeyPair", pumpKeyPairSchema);

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