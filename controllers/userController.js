// --- START OF FILE atu-mining-api/controllers/userController.js (VERSIÓN FINAL Y COMPLETA) ---

const mongoose = require('mongoose');
const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

const CYCLE_DURATION_MS = (ECONOMY_CONFIG.CYCLE_DURATION_HOURS || 24) * 60 * 60 * 1000;

// --- FUNCIÓN SYNCUSER CORREGIDA Y ROBUSTA ---
const syncUser = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        
        console.log(`[Sync] Petición recibida para ID ${telegramId} con refCode: '${refCode}'`);

        if (!telegramId) {
            throw new Error('Telegram ID es requerido.');
        }

        let user = await User.findOne({ telegramId }).session(session);
        let showWelcome = false;

        // Si el usuario no existe, es un nuevo registro
        if (!user) {
            console.log(`[Sync] Usuario nuevo detectado. refCode: '${refCode}'`);
            showWelcome = true;
            
            const newUser_data = { telegramId, firstName, username, photoUrl, hasSeenWelcome: true };

            if (refCode && refCode !== 'null' && refCode !== 'undefined') {
                const referrer = await User.findOne({ telegramId: parseInt(refCode, 10) }).session(session);
                if (referrer) {
                    console.log(`[Sync] Referente ${refCode} encontrado. Asignando...`);
                    newUser_data.referrerId = referrer._id;
                } else {
                    console.warn(`[Sync] Referente con ID ${refCode} no fue encontrado.`);
                }
            }
            
            // Creamos al nuevo usuario DENTRO de la transacción
            const createdUsers = await User.create([newUser_data], { session });
            user = createdUsers[0];
            console.log(`[Sync] Nuevo usuario creado con ID de objeto: ${user._id}`);

            // Si tiene referente, actualizamos al referente DENTRO de la transacción
            if (user.referrerId) {
                await User.updateOne(
                    { _id: user.referrerId },
                    { $push: { referrals: user._id } },
                    { session }
                );
                console.log(`[Sync] El array de referidos del referente ${user.referrerId} ha sido actualizado.`);
            }
        } else { // Es un usuario existente, solo actualizamos sus datos
             user.firstName = firstName || user.firstName;
             user.username = username || user.username;
             user.photoUrl = photoUrl || user.photoUrl;
             await user.save({ session });
        }
        
        // Si todo ha ido bien, confirmamos la transacción
        await session.commitTransaction();

        // Preparamos y enviamos la respuesta
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        res.status(200).json(userObject);

    } catch (error) {
        // Si algo falla, revertimos todos los cambios en la base de datos
        await session.abortTransaction();
        console.error('[Sync] Error fatal en la transacción, rollback ejecutado:', error);
        res.status(500).json({ message: 'Error interno del servidor.', details: error.message });
    } finally {
        // Cerramos la sesión
        session.endSession();
    }
};

// --- claimRewards y getUserData (SIN CAMBIOS) ---

const claimRewards = async (req, res) => {
    try {
        const { telegramId } = req.body;
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }

        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        const elapsedTime = Date.now() - new Date(user.lastClaim).getTime();

        if (elapsedTime < CYCLE_DURATION_MS) {
            return res.status(403).json({ message: 'Aún no puedes reclamar. El ciclo no ha terminado.' });
        }
        
        const totalYieldPerHour = BASE_YIELD_PER_HOUR + (user.boostYieldPerHour || 0);
        const rewardAmount = totalYieldPerHour * CYCLE_DURATION_HOURS;
        
        user.autBalance += rewardAmount;
        user.totalMinedAUT += rewardAmount;
        user.lastClaim = new Date();

        await user.save();

        await Transaction.create({
            userId: user._id, type: 'claim_mining', currency: 'AUT',
            amount: rewardAmount, status: 'completed',
            details: 'Recompensa de minería reclamada'
        });

        res.status(200).json({
            message: `¡Has reclamado ${Math.round(rewardAmount)} AUT!`,
            user: user
        });

    } catch (error) {
        console.error('[CLAIM_FATAL_ERROR] Ha ocurrido un error:', error);
        res.status(500).json({ message: 'Error interno del servidor al reclamar.' });
    }
};

const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate({ path: 'referrals', select: 'firstName photoUrl' });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const userObject = user.toObject();
        userObject.config = ECONOMY_CONFIG;
        
        res.status(200).json(userObject);
    } catch (error) {
        console.error('Error en getUserData:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = { syncUser, getUserData, claimRewards };