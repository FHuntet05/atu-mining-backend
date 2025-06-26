const User = require('../models/User');
const Payment = require('../models/Payment');
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

exports.createPaymentOrder = async (req, res) => {
    try {
        const { telegramId, baseAmount } = req.body;

        if (!telegramId || !baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
            return res.status(400).json({ message: 'Datos inválidos (telegramId, baseAmount).' });
        }

        // Buscamos al usuario por su ID de Telegram
        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        const userId = user._id;

        // Verificamos si ya existe una orden pendiente y no expirada
        const existingPendingPayment = await Payment.findOne({ 
            userId, 
            status: 'pending',
            expiresAt: { $gt: new Date() } 
        });

        if (existingPendingPayment) {
            return res.status(409).json({ 
                message: 'Ya tienes una orden de pago pendiente. Por favor, complétala o espera a que expire.' 
            });
        }

        // Generamos el monto único
        const uniqueAmount = parseFloat((parseFloat(baseAmount) + (Math.random() * 0.0099)).toFixed(6));

        const newPayment = new Payment({
            userId,
            baseAmount: parseFloat(baseAmount),
            uniqueAmount,
            status: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Expira en 10 minutos
        });

        await newPayment.save();
        
        res.status(201).json({
            uniqueAmount: newPayment.uniqueAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });

    } catch (error) {
        console.error("❌ Error en createPaymentOrder:", error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la orden.' });
    }
};