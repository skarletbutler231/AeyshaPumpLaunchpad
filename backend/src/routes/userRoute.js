const express = require('express');
const { isValidUser, isAdminUser } = require("../middleware/auth");
const {
    getInviteCode,
    registerUser,
    loginUser,
    logoutUser,
    loadUser,
    loadAllUsers,
    deleteUser,
    setUserPreset,
    switchUserRole
} = require("../controllers/userController");

const router = express.Router();
router.route('/user/register').post(registerUser);
router.route('/user/login').post(loginUser);
router.route('/user/logout').get(isValidUser, logoutUser);
router.route('/user/me').post(isValidUser, loadUser);
router.route('/user/load-all').post(isValidUser, isAdminUser, loadAllUsers);
router.route('/user/delete').post(isValidUser, isAdminUser, deleteUser);
router.route('/user/switch-free').post(isValidUser, isAdminUser, switchUserRole);
router.route('/user/presets').post(isValidUser, setUserPreset);
router.route('/user/invite-code').post(isValidUser, getInviteCode)

module.exports = router;
