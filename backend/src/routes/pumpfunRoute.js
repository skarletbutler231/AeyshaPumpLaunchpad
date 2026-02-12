const express = require('express');
const { isValidUser } = require("../middleware/auth");
const {
  uploadMetadata,
  getPumpKey,
} = require("../controllers/pumpfunController");

const router = express.Router();
router.route('/pumpfun/upload_metadata').post(isValidUser, uploadMetadata);
router.route('/pumpfun/get_pump_key').post(isValidUser, getPumpKey);

module.exports = router;
