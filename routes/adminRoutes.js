// --- START OF FILE atu-mining-api/routes/adminRoutes.js ---

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Middleware de autenticación
const authAdmin = require('../middleware/authAdmin');

// Modelos y Servicios necesarios
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('../services/boost.service');
const BOOSTS_CONFIG = require('../config/boosts');

// Aplicamos el middleware a todas las rutas de este archivo
router.use(authAdmin);

// --- ENDPOINTS PARA EL BOT ADMIN ---

// 1. Endpoint para obtener estadísticas
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const autBalances = await User.aggregate([{ $group: { _id: null, total: { $sum: '$autBalance' } } }]);
        const totalAUT = autBalances.length > 0 ? autBalances[0].total : 0;
        const totalUsdtBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: '$usdtBalance' } } }]);
        const totalUSDT = totalUsdtBalance.length > 0 ? totalUsdtBalance[0].total : 0;

        res.status(200).json({ totalUsers, totalAUT, totalUSDT });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Endpoint para buscar un usuario
router.get('/user/:telegramId', async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.params.telegramId });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Endpoint para asignar boosts (resolver anomalías)
router.post('/grant-boost', async (req, res) => {
    const { telegramId, boostId, quantity, adminId } = req.body;
    
    const boostConfig = BOOSTS_CONFIG.find(b => b.id === boostId);
    if (!boostConfig || !telegramId || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Datos inválidos." });
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findOne({ telegramId }).session(session);
        if (!user) throw new Error(`Usuario con ID ${telegramId} no encontrado.`);

        await grantBoostsToUser({ userId: user._id, boostId, quantity, session });

        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT', amount: 0,
            status: 'completed',
            details: `Asignación manual de ${quantity}x ${boostConfig.title} por Admin ID: ${adminId}`
        }], { session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Boost asignado con éxito', user });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// 4. Endpoint para gestionar retiros
router.get('/pending-withdrawals', async (req, res) => {
    try {
        const pendingTxs = await Transaction.find({ type: 'withdrawal_request', status: 'pending' }).populate('userId');
        res.status(200).json(pendingTxs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/update-withdrawal-status', async (req, res) => {
    const { transactionId, newStatus } = req.body; // newStatus puede ser 'approve' o 'reject'

    if (!transactionId || !['approve', 'reject'].includes(newStatus)) {
        return res.status(400).json({ message: "Datos inválidos." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const tx = await Transaction.findById(transactionId).session(session);
        if (!tx || tx.status !== 'pending') throw new Error("Transacción no encontrada o ya procesada.");

        if (newStatus === 'approve') {
            tx.status = 'completed';
            tx.type = 'withdrawal_approved';
        } else { // reject
            const user = await User.findById(tx.userId).session(session);
            if (user) {
                user.usdtBalance += Math.abs(tx.amount);
                await user.save({ session });
            }
            tx.status = 'failed';
            tx.type = 'withdrawal_rejected';
        }

        await tx.save({ session });
        await session.commitTransaction();
        res.status(200).json({ message: `Retiro ${newStatus === 'approve' ? 'aprobado' : 'rechazado'} con éxito.`, transaction: tx });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});


// 5. Endpoint para gestionar anomalías
router.get('/anomalous-transactions', async (req, res) => {
    try {
        const anomalies = await AnomalousTransaction.find({ status: 'pending_review' }).sort({ createdAt: -1 }).limit(10);
        res.status(200).json(anomalies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/resolve-anomaly', async (req, res) => {
    const { anomalyId, adminId } = req.body;
    try {
        const anomaly = await AnomalousTransaction.findByIdAndUpdate(anomalyId, {
            status: 'resolved',
            resolvedByAdminId: adminId,
            resolvedAt: new Date()
        }, { new: true });
        if (!anomaly) return res.status(404).json({ message: 'Anomalía no encontrada' });
        res.status(200).json({ message: 'Anomalía resuelta', anomaly });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
// --- END OF FILE atu-mining-api/routes/adminRoutes.js ---