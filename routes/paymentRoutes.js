// En: atu-mining-backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { createPayment } = require('../services/nowpayments.service');
const Payment = require('../models/Payment');
const boostsConfig = require('../config/boosts');

router.post('/create', async (req, res) => {
    try {
        const { telegramId, boostId, amount } = req.body;
        
        // Validaciones más estrictas
        if (!telegramId || !boostId || !amount) {
            return res.status(400).json({ message: 'Faltan datos requeridos (telegramId, boostId, amount).' });
        }
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ message: 'El monto debe ser un número positivo.' });
        }
        
        const boost = boostsConfig.find(b => b.id === boostId);
        if (!boost) {
            return res.status(404).json({ message: 'El boost seleccionado no existe.' });
        }

        const newPayment = new Payment({
            telegramId,
            boostId,
            amount, // El monto total ya viene calculado desde el frontend
            status: 'pending'
        });
        await newPayment.save();

        // Llamamos al servicio para crear la factura en NOWPayments
        const nowPaymentsInvoice = await createPayment(amount, newPayment._id.toString());
        
        // Si la factura se crea, guardamos su ID de NOWPayments
        if (nowPaymentsInvoice && nowPaymentsInvoice.payment_id) {
            newPayment.nowPaymentsId = nowPaymentsInvoice.payment_id;
            await newPayment.save();
        }

        res.status(200).json(nowPaymentsInvoice);

    } catch (error) {
        console.error("Error en la ruta /api/payment/create:", error.message);
        // Devolvemos el mensaje de error que viene del servicio para más claridad
        res.status(500).json({ message: error.message || 'Error interno al crear el pago.' });
    }
});

module.exports = router;