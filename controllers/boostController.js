const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
// Asumo que tienes un archivo de configuración para tus boosts
const BOOSTS_CONFIG = require('../config/boosts'); 

/**
 * Permite a un usuario comprar un boost usando su saldo de depósito interno (usdtBalance).
 */
exports.purchaseWithBalance = async (req, res) => {
    // Usamos una sesión para asegurar que todas las operaciones sean atómicas
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

        // Validación crítica: ¿Tiene el usuario suficiente saldo en usdtBalance?
        if (user.usdtBalance < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Tu saldo de depósito es insuficiente." });
        }

       // --- Aplicamos los cambios al usuario ---
        user.usdtBalance -= (boostToBuy.price * quantity);
        user.boostYieldPerHour += (boostToBuy.dailyYield / 24) * quantity;
       
        // --- INICIO DE CORRECCIÓN ---
        // Marcamos la misión como completada si es la primera compra
        if (!user.hasMadeDeposit) { // Usamos hasMadeDeposit como proxy de primera compra
            user.hasMadeDeposit = true;
        }
        user.missions.firstBoostPurchased = true;
        // --- FIN DE CORRECCIÓN ---
        
        // 3. Registramos la transacción de compra
        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT',
            amount: -(boostToBuy.price * quantity), status: 'completed',
            details: `Compra de ${quantity}x ${boostToBuy.title} con saldo`
        }], { session });


        // Guardamos los cambios en el documento del usuario
        const updatedUser = await user.save({ session });
        
        // Si todo sale bien, confirmamos la transacción en la base de datos
        await session.commitTransaction();

        res.status(200).json({
            message: `¡Compra con saldo exitosa! Tu producción ha aumentado.`,
            user: updatedUser
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error en purchaseWithBalance:", error);
        res.status(500).json({ message: "Error interno al procesar la compra." });
    } finally {
        session.endSession();
    }
};

/**
 * Devuelve la lista de boosts desde el archivo de configuración.
 */
exports.getBoosts = async (req, res) => {
    try {
        res.status(200).json(BOOSTS_CONFIG);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la lista de boosts.' });
    }
};