const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    try {
        const { telegramId, amount } = req.body;
        const baseAmount = parseFloat(amount);

        if (!telegramId || isNaN(baseAmount) || baseAmount <= 0) {
            return res.status(400).json({ message: 'Datos inválidos para crear la orden.' });
        }

        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        const existingPayment = await Payment.findOne({ 
            userId: user._id, 
            status: 'pending',
            expiresAt: { $gt: new Date() } 
        });
        if (existingPayment) {
            return res.status(409).json({ message: 'Ya tienes una orden de pago pendiente.' });
        }

        // --- INICIO DE CORRECCIÓN ANTI-COLISIONES ---
        // Combinamos un número aleatorio con los milisegundos actuales para una unicidad casi perfecta.
        const randomMicroAmount = (Date.now() % 10000) / 10000000 + Math.random() * 0.0001;
        const uniqueAmount = parseFloat((baseAmount + randomMicroAmount).toFixed(6));
        // --- FIN DE CORRECCIÓN ANTI-COLISIONES ---

        const newPayment = new Payment({
            userId: user._id,
            baseAmount: baseAmount,
            uniqueAmount: uniqueAmount,
            status: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });
        await newPayment.save();
        
        console.log(`[PAGOS] Nueva orden creada para ${telegramId}. Monto a pagar: ${uniqueAmount}`);
        
        res.status(201).json({
            uniqueAmount: newPayment.uniqueAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });

    } catch (error) {
        // --- MANEJO DE ERROR MEJORADO ---
        if (error.code === 11000) { // Si el error es de clave duplicada
            console.warn("[PAGOS] Colisión de 'uniqueAmount' detectada. Se reintentará la operación.");
            // Damos una respuesta amigable y le pedimos al usuario que reintente
            return res.status(409).json({ message: 'Hubo una colisión al generar la orden. Por favor, intenta de nuevo.' });
        }
        console.error("Error al crear orden de pago:", error);
        res.status(500).json({ message: 'Error interno al procesar la orden.' });
    }
});

module.exports = router;