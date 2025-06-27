const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        
        // Paso 1: Encontrar al usuario principal
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).select('telegramId referralEarnings referrals');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        // Paso 2: Obtener referidos de Nivel 1
        const level1Users = await User.find({ '_id': { $in: user.referrals } }).select('referrals');
        
        // Paso 3: Obtener referidos de Nivel 2
        const level1Ids = level1Users.map(u => u._id);
        const level2Users = await User.find({ 'referrerId': { $in: level1Ids } }).select('referrals');

        // Paso 4: Obtener referidos de Nivel 3
        const level2Ids = level2Users.map(u => u._id);
        const level3Users = await User.find({ 'referrerId': { $in: level2Ids } });

        // Esta es la forma más rápida y segura de contar, evitando timeouts.
        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1Users.length, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1} USDT` },
              { level: 2, title: 'Nivel 2', invites: level2Users.length, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2} USDT` },
              { level: 3, title: 'Nivel 3', invites: level3Users.length, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3} USDT` },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;