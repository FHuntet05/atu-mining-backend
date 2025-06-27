const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    try {
        const { telegramId, amount, senderAddress } = req.body; // <-- Recibimos la nueva dirección
        const baseAmount = parseFloat(amount);

        if (!telegramId || isNaN(baseAmount) || baseAmount <= 0 || !senderAddress) {
            return res.status(400).json({ message: 'Datos inválidos. Se requiere ID, monto y dirección de origen.' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddress)) {
             return res.status(400).json({ message: 'La dirección de billetera de origen no es válida.' });
        }
        
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const existingPayment = await Payment.findOne({ userId: user._id, status: 'pending', expiresAt: { $gt: new Date() } });
        if (existingPayment) {
            return res.status(409).json({ message: 'Ya tienes una orden de pago pendiente.' });
        }

        const newPayment = new Payment({
            userId: user._id,
            baseAmount,
            senderAddress: senderAddress.toLowerCase(), // Guardamos en minúsculas para una comparación segura
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutos para completar
        });
        await newPayment.save();
        
        res.status(201).json({
            // Ya no enviamos uniqueAmount, solo el monto base y la dirección de destino.
            amountToPay: newPayment.baseAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });

    } catch (error) {
        console.error("Error al crear orden de pago:", error);
        res.status(500).json({ message: 'Error interno al procesar la orden.' });
    }
});
module.exports = router;