// --- START OF FILE atu-mining-backend/controllers/boostController.js ---

const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ActiveBoost = require('../models/ActiveBoost'); // <-- CORRECCIÓN: Modelo importado
const BOOSTS_CONFIG = require('../config/boosts'); // <-- CORRECCIÓN: Importación correcta

exports.purchaseWithBalance = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, boostId, quantity } = req.body;
        const purchaseQuantity = parseInt(quantity, 10) || 1;

        if (!telegramId || !boostId || purchaseQuantity <= 0) {
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
            return res.status(404).json({ message: "El Boost seleccionado no existe." });
        }
        
        const totalCost = boostToBuy.price * purchaseQuantity;

        if (user.usdtBalance < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Saldo de depósito insuficiente." });
        }

        // --- LÓGICA DE COMPRA CORREGIDA ---
        user.usdtBalance -= totalCost;
        
        // Creamos N documentos de ActiveBoost, uno por cada unidad comprada
        const boostsToCreate = [];
        const expirationDate = new Date(Date.now() + boostToBuy.duration * 24 * 60 * 60 * 1000);
        // El yieldIncrease ya está calculado por hora en el config
        const yieldIncrease = boostToBuy.yieldIncrease; 

        for (let i = 0; i < purchaseQuantity; i++) {
            boostsToCreate.push({
                userId: user._id,
                boostId: boostToBuy.id,
                yieldIncreasePerHour: yieldIncrease,
                expiresAt: expirationDate,
            });
        }
        
        // Usamos el modelo ActiveBoost que ahora sí está definido
        const createdBoosts = await ActiveBoost.insertMany(boostsToCreate, { session });
        
        // Añadimos las referencias de los nuevos boosts al usuario
        user.activeBoosts.push(...createdBoosts.map(b => b._id));
        
        // Actualizamos el rendimiento total por hora del usuario
        // Este campo debe existir en el modelo User.js, si no, hay que añadirlo.
        // Asumiré que se llama boostYieldPerHour como en miningRoutes.js
        user.boostYieldPerHour = (user.boostYieldPerHour || 0) + (yieldIncrease * purchaseQuantity);


        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT',
            amount: -totalCost, status: 'completed',
            details: `Compra de ${purchaseQuantity}x ${boostToBuy.title} con saldo`
        }], { session });

        await user.save({ session });
        await session.commitTransaction();

        // Poblamos los activeBoosts para devolver la información completa al frontend
        const updatedUser = await User.findById(user._id).populate('activeBoosts');
        res.status(200).json({ message: '¡Compra exitosa!', user: updatedUser });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error en purchaseWithBalance:", error);
        res.status(500).json({ message: "Error al procesar la compra." });
    } finally {
        session.endSession();
    }
};

// getBoosts no necesita cambios.
exports.getBoosts = async (req, res) => {
    try {
        res.status(200).json(BOOSTS_CONFIG);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la lista de boosts.' });
    }
};
// --- END OF FILE atu-mining-backend/controllers/boostController.js ---