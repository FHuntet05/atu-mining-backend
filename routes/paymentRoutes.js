// --- START OF FILE atu-mining-api/routes/paymentRoutes.js (CON DIAGNÓSTICO) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');
const Payment = require('../models/Payment.js');
const BOOSTS_CONFIG = require('../config/boosts.js');

const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;

router.post('/create', async (req, res) => {
    console.log('➡️ [PAYMENTS] 1. Endpoint /create ALCANZADO. Body de la petición:', req.body);
    try {
        const { telegramId, senderAddress, boostId, quantity } = req.body;
        
        console.log('➡️ [PAYMENTS] 2. Validando datos de entrada...');
        const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);
        const purchaseQuantity = parseInt(quantity, 10) || 1;

        if (!telegramId || !senderAddress || !boostToBuy || purchaseQuantity <= 0) {
            console.error('❌ [PAYMENTS] 2a. ERROR: Datos inválidos.', { telegramId, senderAddress, boostId, quantity });
            return res.status(400).json({ message: 'Datos de la orden de compra inválidos.' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddress)) {
            console.error('❌ [PAYMENTS] 2b. ERROR: Dirección de sender no válida.');
            return res.status(400).json({ message: 'La dirección de billetera de origen no es válida.' });
        }
        console.log('✅ [PAYMENTS] 2c. Datos de entrada validados.');
        
        console.log(`➡️ [PAYMENTS] 3. Buscando usuario con ID: ${telegramId}`);
        const user = await User.findOne({ telegramId });
        if (!user) {
            console.error('❌ [PAYMENTS] 3a. ERROR: Usuario no encontrado.');
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        console.log(`✅ [PAYMENTS] 3b. Usuario ${user.firstName} encontrado.`);

        console.log(`➡️ [PAYMENTS] 4. Buscando órdenes de pago pendientes para el usuario.`);
        const existingPayment = await Payment.findOne({ userId: user._id, status: 'pending', expiresAt: { $gt: new Date() } });
        if (existingPayment) {
            console.error('❌ [PAYMENTS] 4a. ERROR: El usuario ya tiene una orden pendiente.');
            return res.status(409).json({ message: 'Ya tienes una orden de pago pendiente. Por favor, complétala o espera a que expire.' });
        }
        console.log('✅ [PAYMENTS] 4b. No hay órdenes pendientes, se puede crear una nueva.');

        const totalCost = boostToBuy.price * purchaseQuantity;
        console.log(`➡️ [PAYMENTS] 5. Creando nuevo documento de Payment con un costo de ${totalCost} USDT.`);
        
        const newPayment = new Payment({
            userId: user._id,
            senderAddress: senderAddress.toLowerCase(),
            boostId: boostId,
            quantity: purchaseQuantity,
            baseAmount: totalCost,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutos para completar
        });
        
        await newPayment.save();
        console.log('✅ [PAYMENTS] 6. Documento de Payment guardado en la DB con éxito. ID:', newPayment._id);
        
        res.status(201).json({
            amountToPay: newPayment.baseAmount,
            depositAddress: DEPOSIT_WALLET_ADDRESS,
        });
        console.log('✅ [PAYMENTS] 7. Respuesta 201 enviada al frontend.');

    } catch (error) {
        console.error("❌ [PAYMENTS] 8. ERROR FATAL EN EL BLOQUE CATCH:", error);
        res.status(500).json({ message: 'Error interno al procesar la orden de pago.', details: error.message });
    }
});
module.exports = router;
// --- END OF FILE atu-mining-api/routes/paymentRoutes.js (CON DIAGNÓSTICO) ---