const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        // La consulta ahora es limpia, sin logs de depuración
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Consultas optimizadas para no sobrecargar el servidor
        const level1Users = await User.countDocuments({ '_id': { $in: user.referrals } });
        const level1Docs = await User.find({ '_id': { $in: user.referrals } }).select('referrals');
        const level2Users = await User.countDocuments({ 'referrerId': { $in: level1Docs.map(u => u._id) } });
        // La cuenta de nivel 3 es compleja y se omite para mantener el rendimiento alto en producción

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1Users, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1} USDT` },
              { level: 2, title: 'Nivel 2', invites: level2Users, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2} USDT` },
              { level: 3, title: 'Nivel 3', invites: 0, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3} USDT` },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        // Mantenemos solo el log de error real
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;