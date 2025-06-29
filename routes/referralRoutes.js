// atu-mining-api/routes/referralRoutes.js (VERSIÓN FINAL CON CONTEO DE NIVELES CORREGIDO)
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const userId = parseInt(telegramId, 10);

        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Telegram ID inválido.' });
        }

        const user = await User.findOne({ telegramId: userId }).select('_id referrals referralEarnings');
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // --- PIPELINE DE AGREGACIÓN CORREGIDO ---
        const referralStats = await User.aggregate([
            // 1. Empezamos con los referidos directos del usuario (Nivel 1)
            { $match: { _id: { $in: user.referrals } } },
            
            // 2. Agrupamos para contar el Nivel 1 y obtener sus IDs
            {
                $group: {
                    _id: null,
                    level1_docs: { $push: '$$ROOT' }, // Guardamos los documentos completos
                    level1_ids: { $push: '$_id' } // Guardamos solo los IDs
                }
            },
            
            // 3. Buscamos los referidos de Nivel 2 usando los IDs del Nivel 1
            {
                $lookup: {
                    from: 'users',
                    localField: 'level1_ids',
                    foreignField: 'referrerId',
                    as: 'level2_docs'
                }
            },

            // 4. Buscamos los referidos de Nivel 3 usando los IDs del Nivel 2
            {
                $lookup: {
                    from: 'users',
                    localField: 'level2_docs._id',
                    foreignField: 'referrerId',
                    as: 'level3_docs'
                }
            },

            // 5. Proyectamos y calculamos los datos finales
            {
                $project: {
                    _id: 0,
                    level1_count: { $size: '$level1_docs' },
                    level2_count: { $size: '$level2_docs' },
                    level3_count: { $size: '$level3_docs' },
                    level1_earnings: { $multiply: [ { $size: { $filter: { input: "$level1_docs", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level1 ] },
                    level2_earnings: { $multiply: [ { $size: { $filter: { input: "$level2_docs", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level2 ] },
                    level3_earnings: { $multiply: [ { $size: { $filter: { input: "$level3_docs", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level3 ] }
                }
            }
        ]);

        const stats = referralStats[0] || {};
        
        const responseData = {
            code: userId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
                { level: 1, title: 'Nivel 1', invites: stats.level1_count || 0, earnings: (stats.level1_earnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
                { level: 2, title: 'Nivel 2', invites: stats.level2_count || 0, earnings: (stats.level2_earnings || 0).toFixed(2), color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
                { level: 3, title: 'Nivel 3', invites: stats.level3_count || 0, earnings: (stats.level3_earnings || 0).toFixed(2), color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` }
            ]
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;