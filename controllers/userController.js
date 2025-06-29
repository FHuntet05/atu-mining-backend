// atu-mining-api/controllers/userController.js (VERSIÓN FINAL Y ROBUSTA PARA REGISTRO)
const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

const CYCLE_DURATION_HOURS = 24;
const CYCLE_DURATION_MS = CYCLE_DURATION_HOURS * 60 * 60 * 1000;
const BASE_YIELD_PER_HOUR = 350 / 24;

const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        if (!telegramId) return res.status(400).json({ message: 'Telegram ID es requerido.' });

        let user = await User.findOne({ telegramId });
        let showWelcome = false;

        // --- PASO 1: MANEJAR AL USUARIO NUEVO ---
        if (!user) {
            console.log(`[Sync-vFinal] Usuario nuevo detectado: ${telegramId}.`);
            showWelcome = true;
            
            // Creamos el objeto del nuevo usuario
            const newUser_data = {
                telegramId,
                firstName,
                username,
                photoUrl,
                hasSeenWelcome: true
            };

            // Si hay un refCode, buscamos al referente ANTES de crear al nuevo usuario.
            if (refCode) {
                const referrer = await User.findOne({ telegramId: parseInt(refCode, 10) });
                if (referrer) {
                    console.log(`[Sync-vFinal] Referente ${refCode} encontrado. Asignando su ID.`);
                    // Añadimos el ID del referente a los datos del nuevo usuario
                    newUser_data.referrerId = referrer._id;
                } else {
                    console.log(`[Sync-vFinal] RefCode ${refCode} recibido, pero el referente no fue encontrado en la DB.`);
                }
            }
            
            // Creamos y guardamos al nuevo usuario con todos sus datos.
            user = new User(newUser_data);
            await user.save();
            console.log(`[Sync-vFinal] Nuevo usuario ${telegramId} guardado con referrerId: ${user.referrerId}`);

            // --- PASO 2: ACTUALIZAR AL REFERENTE (si existe) ---
            // Esta operación es ahora completamente separada.
            if (user.referrerId) {
                await User.updateOne(
                    { _id: user.referrerId },
                    { $push: { referrals: user._id } }
                );
                console.log(`[Sync-vFinal] El array de referidos del referente ha sido actualizado.`);
            }
        } else { // Es un usuario existente
            user.firstName = firstName || user.firstName;
            user.username = username || user.username;
            user.photoUrl = photoUrl || user.photoUrl;
            await user.save();
        }
        
        // --- PASO 3: ENVIAR RESPUESTA AL FRONTEND ---
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        res.status(200).json(userObject);

    } catch (error) {
        console.error('❌ [Sync-vFinal] Error fatal en syncUser:', error);
        res.status(500).json({ message: 'Error interno grave.', details: error.message });
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