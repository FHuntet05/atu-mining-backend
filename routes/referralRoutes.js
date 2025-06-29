// atu-mining-api/routes/referralRoutes.js (VERSIÓN FINAL CON LÓGICA CORREGIDA)
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Comisiones fijas por cada referido que compra un boost
const COMMISSIONS = {
    level1: 0.27,
    level2: 0.17,
    level3: 0.07
};

// Función auxiliar para calcular las ganancias de un nivel
const calculateEarnings = (referrals, commissionRate) => {
    // Contamos cuántos referidos en esta lista han hecho su primera compra
    const payingReferrals = referrals.filter(ref => ref.hasGeneratedReferralCommission).length;
    return payingReferrals * commissionRate;
};

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // --- LÓGICA DE CONTEO NIVEL POR NIVEL (CLARA Y CORRECTA) ---

        // 1. OBTENER REFERIDOS DE NIVEL 1
        // Usamos .lean() para que la consulta sea más rápida, ya que solo necesitamos leer datos.
        const level1Refs = await User.find({ _id: { $in: user.referrals } }).select('hasGeneratedReferralCommission _id referrerId').lean();

        // 2. OBTENER REFERIDOS DE NIVEL 2
        const level1Ids = level1Refs.map(u => u._id);
        const level2Refs = level1Ids.length > 0 ? await User.find({ referrerId: { $in: level1Ids } }).select('hasGeneratedReferralCommission _id referrerId').lean() : [];
        
        // 3. OBTENER REFERIDOS DE NIVEL 3
        const level2Ids = level2Refs.map(u => u._id);
        const level3Refs = level2Ids.length > 0 ? await User.find({ referrerId: { $in: level2Ids } }).select('hasGeneratedReferralCommission').lean() : [];

        // 4. CALCULAR LOS DATOS FINALES
        const level1Earnings = calculateEarnings(level1Refs, COMMISSIONS.level1);
        const level2Earnings = calculateEarnings(level2Refs, COMMISSIONS.level2);
        const level3Earnings = calculateEarnings(level3Refs, COMMISSIONS.level3);
        
        const responseData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
                { 
                    level: 1, 
                    title: 'Nivel 1', 
                    invites: level1Refs.length, // Conteo correcto
                    earnings: level1Earnings.toFixed(2), 
                    color: '#4ef2f7', 
                    gainPerReferral: `${COMMISSIONS.level1}` 
                },
                { 
                    level: 2, 
                    title: 'Nivel 2', 
                    invites: level2Refs.length, // Conteo correcto
                    earnings: level2Earnings.toFixed(2), 
                    color: '#f7a84e', 
                    gainPerReferral: `${COMMISSIONS.level2}` 
                },
                { 
                    level: 3, 
                    title: 'Nivel 3', 
                    invites: level3Refs.length, // Conteo correcto
                    earnings: level3Earnings.toFixed(2), 
                    color: '#d84ef7', 
                    gainPerReferral: `${COMMISSIONS.level3}` 
                }
            ]
        };
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;