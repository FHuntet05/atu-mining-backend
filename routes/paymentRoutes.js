// En: atu-mining-backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { createPayment } = require('../services/nowpayments.service');
const Payment = require('../models/Payment');

router.post('/create', async (req, res) => {
    try {
        const { telegramId, boostId, amount } = req.body;
        if (!telegramId || !boostId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Faltan datos o son inválidos.' });
        }

        const newPayment = new Payment({
            telegramId,
            boostId, // Guardamos el ID del boost para referencia
            amount: amount,
            status: 'pending'
        });
        await newPayment.save();

        const nowPaymentsInvoice = await createPayment(amount, newPayment._id.toString());
        
        newPayment.nowPaymentsId = nowPaymentsInvoice.payment_id;
        await newPayment.save();

        res.status(200).json(nowPaymentsInvoice);
    } catch (error) {
        console.error("Error en la ruta /api/payment/create:", error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;