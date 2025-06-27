const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    // --- INICIO DE DEPURACIÓN ---
    console.log("=============================================");
    console.log("INICIANDO PETICIÓN A /api/referrals/:telegramId");
    
    try {
        const { telegramId } = req.params;
        console.log(`[PASO 1] Telegram ID recibido de la URL: ${telegramId} (Tipo: ${typeof telegramId})`);

        if (!telegramId || telegramId === 'undefined' || telegramId === 'null') {
            console.error("❌ ERROR: El telegramId recibido es inválido o nulo.");
            return res.status(400).json({ message: 'El ID de Telegram proporcionado es inválido.' });
        }
        
        const numericTelegramId = parseInt(telegramId, 10);
        if (isNaN(numericTelegramId)) {
            console.error(`❌ ERROR: No se pudo convertir '${telegramId}' a un número.`);
            return res.status(400).json({ message: 'El ID de Telegram debe ser un número.' });
        }
        console.log(`[PASO 2] Buscando usuario en la base de datos con ID numérico: ${numericTelegramId}`);

        const user = await User.findOne({ telegramId: numericTelegramId });

        if (!user) {
            console.warn(`⚠️ ADVERTENCIA: No se encontró ningún usuario con el ID ${numericTelegramId}.`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        console.log(`[PASO 3] Usuario encontrado: ${user.firstName} (${user._id})`);

        // La consulta optimizada
        const level1Users = await User.find({ '_id': { $in: user.referrals } }).select('_id');
        const level2Users = await User.find({ 'referrerId': { $in: level1Users.map(u => u._id) } }).select('_id');
        const level3Users = await User.find({ 'referrerId': { $in: level2Users.map(u => u._id) } }).select('_id');

        console.log(`[PASO 4] Conteo de referidos: N1=${level1Users.length}, N2=${level2Users.length}, N3=${level3Users.length}`);

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1Users.length, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1} USDT` },
              { level: 2, title: 'Nivel 2', invites: level2Users.length, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2} USDT` },
              { level: 3, title: 'Nivel 3', invites: level3Users.length, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3} USDT` },
            ]
        };

        console.log("[PASO 5] Enviando respuesta exitosa al frontend.");
        console.log("=============================================");
        res.status(200).json(referralData);

    } catch (error) {
        console.error("💥 ERROR CATASTRÓFICO en /api/referrals:", error);
        console.log("=============================================");
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;