// --- START OF FILE atu-mining-api/routes/referralRoutes.js (CON DIAGNÓSTICO) ---
const express = require('express');
const router = express.Router();
const User = require('../models/User');

console.log('✅ [REFERRALS] 1. Archivo referralRoutes.js ha sido cargado por Node.js.');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    console.log(`➡️ [REFERRALS] 2. Endpoint GET /:telegramId ALCANZADO con params:`, req.params);

    try {
        const { telegramId } = req.params;
        if (!telegramId || isNaN(parseInt(telegramId, 10))) {
            console.error('❌ [REFERRALS] 3a. ERROR: Telegram ID inválido.');
            return res.status(400).json({ message: 'Telegram ID inválido o requerido.' });
        }
        
        console.log(`➡️ [REFERRALS] 3. Buscando usuario en la DB con ID: ${telegramId}`);
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate('referrals');
        console.log('✅ [REFERRALS] 4. Búsqueda en DB completada.');

        if (!user) {
            console.error(`❌ [REFERRALS] 4a. ERROR: Usuario con ID ${telegramId} no encontrado.`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        console.log(`✅ [REFERRALS] 4b. Usuario ${user.firstName} encontrado.`);

        const level1UsersCount = user.referrals.length;
        console.log(`➡️ [REFERRALS] 5. Calculando referidos... Nivel 1: ${level1UsersCount}`);
        
        const level1UserIds = user.referrals.map(ref => ref._id);
        const level2UsersCount = await User.countDocuments({ referrerId: { $in: level1UserIds } });
        console.log(`     -> Nivel 2: ${level2UsersCount}`);
        
        const level2UserDocs = await User.find({ referrerId: { $in: level1UserIds } }).select('_id');
        const level2UserIds = level2UserDocs.map(u => u._id);
        const level3UsersCount = await User.countDocuments({ referrerId: { $in: level2UserIds } });
        console.log(`     -> Nivel 3: ${level3UsersCount}`);

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1UsersCount, earnings: '0.00', color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
              { level: 2, title: 'Nivel 2', invites: level2UsersCount, earnings: '0.00', color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
              { level: 3, title: 'Nivel 3', invites: level3UsersCount, earnings: '0.00', color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` },
            ]
        };
        
        console.log('✅ [REFERRALS] 6. Datos preparados. Enviando respuesta 200 OK.');
        res.status(200).json(referralData);

    } catch (error) {
        console.error("❌ [REFERRALS] 7. ERROR FATAL EN EL BLOQUE CATCH:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-api/routes/referralRoutes.js (CON DIAGNÓSTICO) ---