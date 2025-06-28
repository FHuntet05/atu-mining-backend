// --- START OF FILE atu-mining-api/routes/referralRoutes.js (FINAL Y LIMPIO) ---
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        if (!telegramId || isNaN(parseInt(telegramId, 10))) {
            return res.status(400).json({ message: 'Telegram ID inválido o requerido.' });
        }
        
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate('referrals');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const level1UsersCount = user.referrals.length;
        
        const level1UserIds = user.referrals.map(ref => ref._id);
        const level2UsersCount = await User.countDocuments({ referrerId: { $in: level1UserIds } });
        
        const level2UserDocs = await User.find({ referrerId: { $in: level1UserIds } }).select('_id');
        const level2UserIds = level2UserDocs.map(u => u._id);
        const level3UsersCount = await User.countDocuments({ referrerId: { $in: level2UserIds } });

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1UsersCount, earnings: '0.00', color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
              { level: 2, title: 'Nivel 2', invites: level2UsersCount, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
              { level: 3, title: 'Nivel 3', invites: level3UsersCount, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` },
            ]
        };
        
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-api/routes/referralRoutes.js (FINAL Y LIMPIO) ---