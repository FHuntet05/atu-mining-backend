const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const BOOSTS_CONFIG = require('../config/boosts');

const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    try {
        const { telegramId, senderAddress, boostId, quantity } = req.body;

        const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);
        const purchaseQuantity = parseInt(quantity, 10) || 1;

        if (!telegramId || !senderAddress || !boostToBuy || purchaseQuantity <= 0) {
            return res.status(400).json({ message: 'Datos de la orden de compra inválidos.' });
        }
        //Validacion de la dirección
        if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddress)) {
             return res.status(400).json({ message: 'La dirección de billetera de origen no es válida.' });
        }
        
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        //Validación de pago pendiente
        const existingPayment = await Payment.findOne({ userId: user._id, status: 'pending', expiresAt: { $gt: new Date() } });
        if (existingPayment) {
            return res.status(409).json({ message: 'Ya tienes una orden de pago pendiente.' });
        }

        const totalCost = boostToBuy.price * purchaseQuantity;

        const newPayment = new Payment({
            userId: user._id,
            senderAddress: senderAddress.toLowerCase(),
            boostId: boostId,
            quantity: purchaseQuantity,
            baseAmount: totalCost,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });
        await newPayment.save();
        
        res.status(201).json({
            amountToPay: newPayment.baseAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });

    } catch (error) {
        console.error("Error al crear orden de pago:", error);
        res.status(500).json({ message: 'Error interno al procesar la orden.' });
    }
});
module.exports = router;