// En: atu-mining-backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { createPayment } = require('../services/nowpayments.service');
const Payment = require('../models/Payment');
const boostsConfig = require('../config/boosts'); // Reutilizamos la config de boosts

router.post('/create', async (req, res) => {
    try {
        const { telegramId, boostId } = req.body;
        if (!telegramId || !boostId) return res.status(400).json({ message: 'Faltan datos.' });

        const boost = boostsConfig.find(b => b.id === boostId);
        if (!boost) return res.status(404).json({ message: 'Boost no encontrado.' });

        const newPayment = new Payment({
            telegramId,
            boostId,
            amount: boost.price,
            status: 'pending'
        });
        await newPayment.save();

        const nowPaymentsInvoice = await createPayment(boost.price, newPayment._id.toString());
        
        // Guardamos el ID de NOWPayments para referencia futura
        newPayment.nowPaymentsId = nowPaymentsInvoice.payment_id;
        await newPayment.save();

        res.status(200).json(nowPaymentsInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;