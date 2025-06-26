const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment'); // Asegúrate de que este es el modelo corregido
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    try {
        const { telegramId, amount } = req.body;
        if (!telegramId || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Datos inválidos.' });
        }
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        const existingPayment = await Payment.findOne({ 
            userId: user._id, 
            status: 'pending',
            expiresAt: { $gt: new Date() } 
        });
        if (existingPayment) {
            return res.status(409).json({ message: 'Ya tienes una orden pendiente.' });
        }

        const baseAmount = parseFloat(amount);
        const uniqueAmount = parseFloat((baseAmount + (Math.random() * 0.0099)).toFixed(6));

        // Esta creación ahora funcionará porque el modelo ya no pide boostId ni telegramId
        const newPayment = new Payment({
            userId: user._id,
            baseAmount,
            uniqueAmount,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });
        await newPayment.save();
        
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