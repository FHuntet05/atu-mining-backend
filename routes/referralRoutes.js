// En: atu-mining-backend/routes/referralRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const directReferralsCount = user.referrals ? user.referrals.length : 0;

        const referralData = {
            code: user.telegramId,
            totalEarnings: 0,
            tiers: [
              { level: 1, title: 'Invitaciones Directas', invites: directReferralsCount, earnings: 0, color: '#4ef2f7', gainPerReferral: 0.27 },
              { level: 2, title: 'Invitados de tus Invitados', invites: 0, earnings: 0, color: '#f7a84e', gainPerReferral: 0.17 },
              { level: 3, title: 'Tercer Nivel', invites: 0, earnings: 0, color: '#d84ef7', gainPerReferral: 0.07 },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;
