const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    try {
        // Obtenemos los datos y nos aseguramos de que el monto sea un número
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

        // --- INICIO DE CORRECCIÓN CRÍTICA ---
        // Aseguramos que todas las operaciones sean numéricas y generamos el monto único correctamente.
        const randomFraction = Math.random() * 0.009999;
        const uniqueAmount = parseFloat((baseAmount + randomFraction).toFixed(6));
        // --- FIN DE CORRECCIÓN CRÍTICA ---

        const newPayment = new Payment({
            userId: user._id,
            baseAmount: baseAmount,
            uniqueAmount: uniqueAmount,
            status: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Expira en 10 mins
        });
        await newPayment.save();
        
        console.log(`[PAGOS] Nueva orden creada para ${telegramId}. Monto a pagar: ${uniqueAmount}`);
        
        res.status(201).json({
            uniqueAmount: newPayment.uniqueAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });

    } catch (error) {
        console.error("Error al crear orden de pago:", error);
        res.status(500).json({ message: 'Error interno al procesar la orden.' });
    }
});

module.exports = router;