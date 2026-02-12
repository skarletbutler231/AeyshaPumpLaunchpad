const mongoose = require('mongoose');

const presetSchema = new mongoose.Schema({
    name: String,
    value: String,
});

module.exports = mongoose.model("Preset", presetSchema);
