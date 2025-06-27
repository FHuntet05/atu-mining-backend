const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const BOOSTS_CONFIG = require('../config/tasks'); // Asumiendo que tus boosts están en un archivo de config

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

        // --- Aplicamos los cambios al usuario ---
        user.usdtBalance -= totalCost;
        const yieldIncreasePerHour = (boostToBuy.dailyYield / 24) * purchaseQuantity;
        user.boostYieldPerHour += yieldIncreasePerHour;
        
        // --- INICIO DE CORRECCIÓN ---
        // Si el objeto 'missions' no existe en este documento de usuario, lo inicializamos.
        if (!user.missions) {
            user.missions = {};
        }
        // Ahora es seguro asignar la propiedad.
        user.missions.firstBoostPurchased = true;
        // --- FIN DE CORRECCIÓN ---

        // También marcamos hasMadeDeposit, ya que una compra con saldo implica un depósito previo.
        if (!user.hasMadeDeposit) {
            user.hasMadeDeposit = true;
        }

        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT',
            amount: -totalCost, status: 'completed',
            details: `Compra de ${purchaseQuantity}x ${boostToBuy.title} con saldo`
        }], { session });

        const updatedUser = await user.save({ session });
        await session.commitTransaction();

        res.status(200).json({
            message: `¡Compra exitosa! Tu producción ha aumentado.`,
            user: updatedUser
        });

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