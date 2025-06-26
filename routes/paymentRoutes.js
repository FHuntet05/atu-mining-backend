// En: atu-mining-backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

router.post('/create', async (req, res) => {
    try {
        const { telegramId, boostId, amount } = req.body;
        // Generamos un "polvo" decimal aleatorio
        const randomDust = Math.floor(100000 + Math.random() * 900000) / 100000000; // ej. 0.00123456
        const uniqueAmount = parseFloat((amount + randomDust).toFixed(8));

        const newPayment = new Payment({
            telegramId,
            boostId,
            baseAmount: amount,
            uniqueAmount,
            status: 'pending'
        });
        await newPayment.save();

        res.status(200).json({
            depositAddress: process.env.DEPOSIT_WALLET_ADDRESS,
            uniqueAmount: uniqueAmount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la orden de pago.' });
    }
});
module.exports = router;