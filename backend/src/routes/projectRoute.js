const express = require("express");
const { isValidUser, isAdminUser } = require("../middleware/auth");
const {
    add100Wallets,
    checkCreateProjectMode,
    createProject,
    deleteProject,
    checkProject,
    activateProject,
    loadAllProjects,
    saveProject,
    estimateSwapAmountOut,
    swapToken,
    generateWallets,
    downloadWallets,
    simulateBuyTokens,
    disperseSOLs,
    buyTokens,
    disperseTokens,
    sellTokens,
    transferTokens,
    collectAllSol,
    collectAllFee,
    simulateBuyPumpfunTokens,
    mintAndSnipePumpfunTokens,
    mintAndBuyPumpfunTokens,
    mintPumpfunToken,
    buyPumpfunTokens,
    sellPumpfunTokens,
    preDisperseTokens,
    addAdditionalWallets,
    sendOrReceive,
    handleLimitSwap,
    pumpfunDisperseSOLs,
    removeAdditionalWallets,
    setTokenAddress,
    transferAll,
    sellAllFromExtraWallet,
    simulateFairBuyTokens,
    fairBuyTokens,
    unfreezePool,
    uploadWallets,
    burnTaxToken,
    pumpfunDisperseSOLsViaMirrors,
    disperseSOLsViaMirrors
} = require("../controllers/projectController.js");

const router = express.Router();
router.route('/project/check-create-mode').post(isValidUser, checkCreateProjectMode);
router.route('/project/create').post(isValidUser, createProject);
router.route('/project/delete').post(isValidUser, deleteProject);
router.route('/project/check-status').post(isValidUser, checkProject);
router.route('/project/activate').post(isValidUser, isAdminUser, activateProject);
router.route('/project/load-all').post(isValidUser, loadAllProjects);
router.route('/project/save').post(isValidUser, saveProject);
router.route('/project/generate-wallets').post(isValidUser, generateWallets);
router.route('/project/upload-wallets').post(isValidUser, uploadWallets);
router.route('/project/download-wallets').post(isValidUser, downloadWallets);
router.route('/project/collect-all-sol').post(isValidUser, collectAllSol);
router.route('/project/simulate').post(isValidUser, simulateBuyTokens);
router.route('/project/simulate-fair').post(isValidUser, simulateFairBuyTokens);
router.route('/project/disperse').post(isValidUser, disperseSOLsViaMirrors);
router.route('/project/predisperse-tokens').post(isValidUser, preDisperseTokens);
router.route('/project/buy').post(isValidUser, buyTokens);
router.route('/project/buy-fair').post(isValidUser, fairBuyTokens);
router.route('/project/burn-tax-token').post(isValidUser, burnTaxToken);
router.route('/project/unfreeze-pool').post(isValidUser, unfreezePool);
router.route('/project/disperse-tokens').post(isValidUser, disperseTokens);
router.route('/project/sell').post(isValidUser, sellTokens);
router.route('/project/transfer').post(isValidUser, transferTokens);
router.route('/project/transfer-all').post(isValidUser, transferAll);
router.route('/project/estimate-swap-amount-out').post(isValidUser, estimateSwapAmountOut);
router.route('/project/handle-swap').post(isValidUser, swapToken);
router.route('/project/add-additional-wallet').post(isValidUser, addAdditionalWallets);
router.route('/project/remove-additional-wallet').post(isValidUser, removeAdditionalWallets);
router.route('/project/send-or-receive').post(isValidUser, sendOrReceive);
router.route('/project/handle-limit-swap').post(isValidUser, handleLimitSwap);
router.route('/project/add-100-wallets').post(isValidUser, add100Wallets);
// pumpfun
router.route('/project/pumpfun-simulate').post(isValidUser, simulateBuyPumpfunTokens);
router.route('/project/pumpfun-mint-snipe').post(isValidUser, mintAndSnipePumpfunTokens);
router.route('/project/pumpfun-mint-buy').post(isValidUser, mintAndBuyPumpfunTokens);
router.route('/project/pumpfun-mint').post(isValidUser, mintPumpfunToken);
router.route('/project/pumpfun-buy').post(isValidUser, buyPumpfunTokens);
router.route('/project/pumpfun-sell').post(isValidUser, sellPumpfunTokens);
router.route('/project/pumpfun-disperse').post(isValidUser, pumpfunDisperseSOLs);
router.route('/project/collect-fee').post(isValidUser, isAdminUser, collectAllFee);

router.route('/project/set-token-address').post(isValidUser, setTokenAddress);
router.route('/project/remove-lp').post(isValidUser, sellAllFromExtraWallet);

module.exports = router;
