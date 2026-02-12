const express = require("express");
const { isValidUser, isAdminUser } = require("../middleware/auth");
const { collectAllSol, sendTaxWallet, receiveTaxWallet } = require("../controllers/adminController");

const router = express.Router();
router.route('/admin/collect-all-sol').post(isValidUser, isAdminUser, collectAllSol);
router.route('/admin/get-tax-wallet').post(isValidUser, isAdminUser, sendTaxWallet);
router.route('/admin/set-tax-wallet').post(isValidUser, isAdminUser, receiveTaxWallet);
module.exports = router;