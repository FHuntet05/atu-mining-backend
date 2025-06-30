// --- START OF FILE atu-mining-api/controllers/userController.js (VERSIÓN FINAL PRAGMÁTICA) ---

const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

const CYCLE_DURATION_MS = (ECONOMY_CONFIG.CYCLE_DURATION_HOURS || 24) * 60 * 60 * 1000;

// --- FUNCIÓN SYNCUSER SIN TRANSACCIONES ---
const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }

        let user = await User.findOne({ telegramId });
        let showWelcome = false;

        // Si el usuario no existe, es un nuevo registro
        if (!user) {
            showWelcome = true;
            console.log(`[Sync-Pragmatic] Usuario nuevo. Procesando referido '${refCode}'`);
            
            const newUser_data = { telegramId, firstName, username, photoUrl, hasSeenWelcome: true };
            let referrer = null;

            if (refCode && refCode !== 'null' && refCode !== 'undefined') {
                referrer = await User.findOne({ telegramId: parseInt(refCode, 10) });
                if (referrer) {
                    console.log(`[Sync-Pragmatic] Referente encontrado. ID: ${referrer._id}`);
                    newUser_data.referrerId = referrer._id;
                } else {
                    console.warn(`[Sync-Pragmatic] Referente con ID ${refCode} no encontrado.`);
                }
            }
            
            // Paso 1: Crear y guardar al nuevo usuario.
            user = new User(newUser_data);
            await user.save();
            console.log(`[Sync-Pragmatic] Nuevo usuario creado. ID: ${user._id}`);

            // Paso 2: Si hubo un referente, actualizarlo en una operación separada.
            if (referrer) {
                await User.updateOne(
                    { _id: referrer._id },
                    { $push: { referrals: user._id } }
                );
                console.log(`[Sync-Pragmatic] Array de referidos del referente actualizado.`);
            }
        } else { // Usuario existente
             user.firstName = firstName || user.firstName;
             user.username = username || user.username;
             user.photoUrl = photoUrl || user.photoUrl;
             await user.save();
        }
        
        // Preparamos y enviamos la respuesta exitosa
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        res.status(200).json(userObject);

    } catch (error) {
        console.error('[Sync-Pragmatic] Error fatal:', error);
        res.status(500).json({ message: 'Error interno del servidor.', details: error.message });
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