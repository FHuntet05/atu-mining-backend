const User = require('../models/User');
const Payment = require('../models/Payment');
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

/**
 * Crea una nueva orden de pago.
 * Esta función es llamada desde tu componente `BoostPage` (o similar).
 */
exports.createPaymentOrder = async (req, res) => {
    try {
        const { telegramId, baseAmount } = req.body;

        if (!telegramId || !baseAmount || baseAmount <= 0) {
            return res.status(400).json({ message: 'Faltan datos válidos para crear la orden.' });
        }

        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        const userId = user._id;

        // CORRECCIÓN: Verificamos si ya existe una orden pendiente.
        const existingPendingPayment = await Payment.findOne({ 
            userId, 
            status: 'pending',
            expiresAt: { $gt: new Date() } // Solo consideramos las que no han expirado
        });

        if (existingPendingPayment) {
            return res.status(409).json({ 
                message: 'Ya tienes una orden de pago pendiente. Por favor, complétala o espera a que expire (10 minutos).' 
            });
        }

        // Generamos un monto único para identificar la transacción en la blockchain
        const uniqueAmount = parseFloat((baseAmount + (Math.random() * 0.0099)).toFixed(6));

        const newPayment = new Payment({
            userId,
            baseAmount,
            uniqueAmount,
            status: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // La orden expira en 10 minutos
        });

        await newPayment.save();

        // Devolvemos la información que `DepositModal.jsx` necesita mostrar
        res.status(201).json({
            uniqueAmount: newPayment.uniqueAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
            // Podemos añadir más datos si el frontend los necesita
        });

    } catch (error) {
        console.error("Error en createPaymentOrder:", error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la orden.' });
    }
};