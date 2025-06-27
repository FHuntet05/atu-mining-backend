const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS_RATES = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) })
            .populate({ path: 'referrals', populate: { path: 'referrals', model: 'User' } });

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const level1Users = user.referrals || [];
        const level2Users = level1Users.flatMap(l1 => l1.referrals || []);
        const level3Users = []; // El populate actual no llega al nivel 3, lo dejamos en 0 por simplicidad

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0, // Usamos el campo actualizado
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1Users.length, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: COMMISSIONS_RATES.level1 },
              { level: 2, title: 'Nivel 2', invites: level2Users.length, earnings: 'N/A', color: '#f7a84e', gainPerReferral: COMMISSIONS_RATES.level2 },
              { level: 3, title: 'Nivel 3', invites: level3Users.length, earnings: 'N/A', color: '#d84ef7', gainPerReferral: COMMISSIONS_RATES.level3 },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;