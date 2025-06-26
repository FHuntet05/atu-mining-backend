const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');

// GET /api/referrals/:telegramId
router.get('/:telegramId', referralController.getReferralData);

module.exports = router;