// --- START OF FILE atu-mining-backend/routes/withdrawalRoutes.js ---

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');
const { Telegraf } = require('telegraf');

if (!process.env.ADMIN_BOT_TOKEN || !process.env.ADMIN_IDS) {
    console.warn("ADVERTENCIA: Variables de admin no configuradas.");
}
const adminBot = new Telegraf(process.env.ADMIN_BOT_TOKEN);

router.post('/request', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, amount, walletAddress } = req.body;
        const withdrawalAmount = parseFloat(amount);

        // --- 1. Validaciones de Entrada ---
        if (!telegramId || !withdrawalAmount || !walletAddress) {
            return res.status(400).json({ message: 'Faltan datos en la solicitud (telegramId, amount, walletAddress).' });
        }
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            return res.status(400).json({ message: 'El monto a retirar debe ser un número positivo.' });
        }
        // Validación básica de la dirección de billetera BEP20
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({ message: 'La dirección de billetera proporcionada no es válida.' });
        }

        const user = await User.findOne({ telegramId }).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // --- 2. Validaciones de Negocio ---
        // Verificar si el usuario tiene suficiente saldo retirable
         if (user.usdtBalance < withdrawalAmount) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Fondos insuficientes para realizar este retiro.' });
        }
        // Verificar el enfriamiento de 24 horas
        if (user.lastWithdrawalRequest) {
            const timeSinceLastRequest = Date.now() - user.lastWithdrawalRequest.getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;
            if (timeSinceLastRequest < twentyFourHours) {
                await session.abortTransaction();
                const hoursRemaining = Math.ceil((twentyFourHours - timeSinceLastRequest) / (60 * 60 * 1000));
                return res.status(429).json({ message: `Debes esperar aproximadamente ${hoursRemaining} horas para realizar otra solicitud.` });
            }
        }
        
        // --- 3. Procesamiento de la Solicitud (Transacción Atómica) ---
        // Descontamos el saldo del usuario y actualizamos la fecha de solicitud
        user.usdtBalance -= withdrawalAmount; // Se resta del único usdtBalance
        user.lastWithdrawalRequest = new Date();
        const updatedUser = await user.save({ session });

        // Creamos un registro de la transacción
        const newTransaction = new Transaction({
            userId: user._id,
            type: 'withdrawal_request',
            currency: 'USDT',
            amount: -withdrawalAmount,
            status: 'pending',
            details: `Solicitud de retiro a la billetera: ${walletAddress}`
        });
        await newTransaction.save({ session });

        // --- 4. Notificación al Bot de Administración ---
        // Preparamos el mensaje para ser enviado como un comando al bot de admin
        const notificationText = `/notify_withdrawal ${user._id} ${withdrawalAmount.toFixed(2)} ${walletAddress} ${user.telegramId} ${user.firstName}`;
        
        // Obtenemos el primer ID de admin para enviar el comando
        const firstAdminId = process.env.ADMIN_IDS.split(',')[0].trim();
        if (firstAdminId && process.env.ADMIN_BOT_TOKEN) {
            await adminBot.telegram.sendMessage(firstAdminId, notificationText);
        } else {
            console.warn("No se pudo enviar la notificación de retiro porque falta el ID de admin o el token.");
        }

        // Si todo sale bien, confirmamos la transacción en la base de datos
        await session.commitTransaction();
        
        // --- 5. Respuesta Exitosa al Usuario ---
        res.status(200).json({
            message: 'Tu solicitud de retiro ha sido enviada y está en revisión. Recibirás el pago en las próximas 24 horas.',
            user: updatedUser // Enviamos el usuario actualizado de vuelta al frontend
        });

    } catch (error) {
        // Si algo falla, revertimos todos los cambios en la base de datos
        await session.abortTransaction();
        console.error("Error en la solicitud de retiro:", error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la solicitud.' });
    } finally {
        // Siempre terminamos la sesión
        session.endSession();
    }
});

module.exports = router;