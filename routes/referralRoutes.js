// En: atu-mining-backend/routes/referralRoutes.js
// CÓDIGO COMPLETO Y ACTUALIZADO

const express = require('express');
const router = express.Router();
const User = require('../models/User');

const REFERRAL_BONUS_USDT = 0.5; // Comisión por cada referido activo

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const totalReferrals = user.referrals ? user.referrals.length : 0;
        const activeReferrals = user.activeReferrals ? user.activeReferrals.length : 0;
        const totalEarnings = user.referralEarnings || 0;

        // Preparamos los datos para el frontend
        const referralData = {
            code: user.telegramId,
            totalReferrals: totalReferrals,
            activeReferrals: activeReferrals,
            totalEarnings: totalEarnings,
            // Enviamos un solo nivel, que es el que hemos implementado
            tiers: [
              { 
                level: 1, 
                title: 'Referidos Directos', 
                invites: `${activeReferrals} / ${totalReferrals}`, // Formato "activos / totales"
                earnings: totalEarnings.toFixed(2), 
                color: '#4ef2f7', 
                gainPerReferral: `${REFERRAL_BONUS_USDT} USDT` 
              },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;
