// En: atu-mining-backend/routes/referralRoutes.js
// CÓDIGO COMPLETO Y CORREGIDO

const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId }).populate({
            path: 'referrals',
            populate: {
                path: 'referrals',
                model: 'User'
            }
        });

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const level1Users = user.referrals || [];
        const level1ActiveCount = user.activeReferrals ? user.activeReferrals.length : 0;
        
        let level2Count = 0;
        let level3Count = 0;

        for (const l1 of level1Users) {
            level2Count += l1.referrals ? l1.referrals.length : 0;
            if (l1.referrals) {
                for (const l2 of l1.referrals) {
                    const l2User = await User.findById(l2._id);
                    level3Count += l2User && l2User.referrals ? l2User.referrals.length : 0;
                }
            }
        }

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: `${level1ActiveCount} / ${level1Users.length}`, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1} USDT` },
              { level: 2, title: 'Nivel 2', invites: level2Count, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2} USDT` },
              { level: 3, title: 'Nivel 3', invites: level3Count, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3} USDT` },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});
module.exports = router;