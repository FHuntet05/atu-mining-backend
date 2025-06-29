// atu-mining-api/routes/referralRoutes.js (VERSIÓN FINAL Y OPTIMIZADA)
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const mongoose = require('mongoose');

// Definimos las comisiones en un solo lugar para mantener la consistencia
const COMMISSIONS = {
    level1: 0.27,
    level2: 0.17,
    level3: 0.07,
};

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const userId = parseInt(telegramId, 10);

        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Telegram ID inválido.' });
        }

        const userObjectId = await User.findOne({ telegramId: userId }).select('_id');
        if (!userObjectId) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // --- PIPELINE DE AGREGACIÓN DE MONGODB ---
        // Esta es la forma más eficiente de obtener todos los datos que necesitamos.
        const referralStats = await User.aggregate([
            // 1. Encontrar al usuario principal
            { $match: { _id: userObjectId._id } },
            
            // 2. Traer los datos de los referidos de Nivel 1
            {
                $lookup: {
                    from: 'users',
                    localField: 'referrals',
                    foreignField: '_id',
                    as: 'level1Referrals'
                }
            },
            
            // 3. Traer los datos de los referidos de Nivel 2
            {
                $lookup: {
                    from: 'users',
                    localField: 'level1Referrals._id',
                    foreignField: 'referrerId',
                    as: 'level2Referrals'
                }
            },

            // 4. Traer los datos de los referidos de Nivel 3
            {
                $lookup: {
                    from: 'users',
                    localField: 'level2Referrals._id',
                    foreignField: 'referrerId',
                    as: 'level3Referrals'
                }
            },

            // 5. Proyectar y calcular los datos finales que enviaremos al frontend
            {
                $project: {
                    _id: 0, // No necesitamos el ID en la respuesta final
                    code: '$telegramId',
                    totalEarnings: '$referralEarnings',
                    level1: {
                        count: { $size: '$level1Referrals' },
                        // Calculamos las ganancias contando cuántos han comprado
                        earnings: { $multiply: [ { $size: { $filter: { input: "$level1Referrals", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level1 ] }
                    },
                    level2: {
                        count: { $size: '$level2Referrals' },
                        earnings: { $multiply: [ { $size: { $filter: { input: "$level2Referrals", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level2 ] }
                    },
                    level3: {
                        count: { $size: '$level3Referrals' },
                        earnings: { $multiply: [ { $size: { $filter: { input: "$level3Referrals", as: "ref", cond: { $eq: [ "$$ref.hasGeneratedReferralCommission", true ] } } } }, COMMISSIONS.level3 ] }
                    }
                }
            }
        ]);

        if (referralStats.length === 0) {
            // Esto puede pasar si el usuario existe pero no tiene referidos
            return res.status(200).json({
                code: userId,
                totalEarnings: 0,
                tiers: [
                  { level: 1, title: 'Nivel 1', invites: 0, earnings: 0, color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
                  { level: 2, title: 'Nivel 2', invites: 0, earnings: 0, color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
                  { level: 3, title: 'Nivel 3', invites: 0, earnings: 0, color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` },
                ]
            });
        }
        
        const data = referralStats[0];

        // Formateamos la respuesta para que coincida con lo que espera el frontend
        const responseData = {
            code: data.code,
            totalEarnings: data.totalEarnings,
            tiers: [
                { level: 1, title: 'Nivel 1', invites: data.level1.count, earnings: data.level1.earnings.toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
                { level: 2, title: 'Nivel 2', invites: data.level2.count, earnings: data.level2.earnings.toFixed(2), color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
                { level: 3, title: 'Nivel 3', invites: data.level3.count, earnings: data.level3.earnings.toFixed(2), color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` }
            ]
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;