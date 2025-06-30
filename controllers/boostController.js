// --- START OF FILE atu-mining-backend/controllers/boostController.js (COMPLETO Y CORREGIDO) ---

const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const BOOSTS_CONFIG = require('../config/boosts');
const { grantBoostsToUser } = require('../services/boost.service');
// --- !! IMPORTAMOS EL SERVICIO DE COMISIONES !! ---
const { processReferralCommissions } = require('../services/referral.service');

exports.purchaseWithBalance = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, boostId, quantity } = req.body;
        const purchaseQuantity = parseInt(quantity, 10) || 1;

        const user = await User.findOne({ telegramId }).session(session);
        const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);

        if (!user || !boostToBuy || purchaseQuantity <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Datos de la compra inválidos." });
        }
        
        const totalCost = boostToBuy.price * purchaseQuantity;

        if (user.usdtBalance < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Saldo de USDT insuficiente." });
        }
        
        await grantBoostsToUser({
            userId: user._id,
            boostId,
            quantity: purchaseQuantity,
            session,
            purchaseMethod: 'balance',
            totalCost
        });

        // --- !! INYECTAMOS LA LÓGICA DE COMISIONES AQUÍ !! ---
        // Justo después de que la compra es exitosa, intentamos procesar las comisiones.
        // Le pasamos el comprador y la sesión para mantener la transacción atómica.
        await processReferralCommissions({ buyer: user, session });
        
        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT',
            amount: -totalCost, status: 'completed',
            details: `Compra de ${purchaseQuantity}x ${boostToBuy.title} con saldo`
        }], { session });

        await session.commitTransaction();

        const updatedUser = await User.findById(user._id).populate('activeBoosts');
        res.status(200).json({ message: '¡Compra exitosa!', user: updatedUser });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error en purchaseWithBalance:", error);
        res.status(500).json({ message: error.message || "Error al procesar la compra." });
    } finally {
        session.endSession();
    }
};

exports.getBoosts = async (req, res) => {
    try {
        res.status(200).json(BOOSTS_CONFIG);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la lista de boosts.' });
    }
};

// --- END OF FILE atu-mining-backend/controllers/boostController.js ---