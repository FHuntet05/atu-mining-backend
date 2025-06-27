const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const BOOSTS_CONFIG = require('../config/boosts'); // Asumiendo que tus boosts están en un archivo de config

exports.purchaseWithBalance = async (req, res) => {
    // Usamos una sesión para asegurar que todas las operaciones sean atómicas
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, boostId, quantity } = req.body;
        const amount = parseInt(quantity, 10) || 1;

        if (!telegramId || !boostId || amount <= 0) {
            return res.status(400).json({ message: "Datos de la compra inválidos." });
        }

        const user = await User.findOne({ telegramId }).session(session);
        const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        if (!boostToBuy) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Boost no encontrado." });
        }
        
        const totalCost = boostToBuy.price * amount;

        // Validación crítica: ¿Tiene el usuario suficiente saldo?
        if (user.usdtBalance < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Saldo de depósito insuficiente." });
        }

        // --- Aplicamos los cambios ---
        // 1. Restamos el coste del saldo del usuario
        user.usdtBalance -= totalCost;

        // 2. Calculamos y añadimos el aumento de producción
        const yieldIncreasePerHour = (boostToBuy.dailyYield / 24) * amount;
        user.boostYieldPerHour = (user.boostYieldPerHour || 0) + yieldIncreasePerHour;
        
        // 3. Registramos la transacción de compra
        await Transaction.create([{
            userId: user._id,
            type: 'purchase',
            currency: 'USDT',
            amount: -totalCost, // Negativo porque es un gasto
            status: 'completed',
            details: `Compra de ${amount}x ${boostToBuy.title}`
        }], { session });

        // Guardamos los cambios en el usuario
        const updatedUser = await user.save({ session });
        
        // Si todo sale bien, confirmamos la transacción
        await session.commitTransaction();

        res.status(200).json({
            message: `¡Compra exitosa! Tu producción ha aumentado.`,
            user: updatedUser
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error en purchaseWithBalance:", error);
        res.status(500).json({ message: "Error interno del servidor al procesar la compra." });
    } finally {
        session.endSession();
    }
};

exports.getBoosts = async (req, res) => {
    // Esta función simplemente devuelve la lista de boosts desde la configuración
    try {
        res.status(200).json(BOOSTS_CONFIG);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la lista de boosts.' });
    }
};