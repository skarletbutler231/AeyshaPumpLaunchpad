const mongoose = require('mongoose');

const limitOrderSchema = new mongoose.Schema({
    projectid: String,
    address: String,
    amountin: String,
    amountoutmin: String,
    from: String,
    to: String,
    targetunit: String,
    targetindex: String,
    targetprice: String,
    isbigger: Boolean,
    expiry: String,
    expired: Boolean,
});

module.exports = mongoose.model("LimitOrder", limitOrderSchema);
