// atu-mining-api/controllers/userController.js (VERSIÓN FINAL Y ROBUSTA PARA REGISTRO)
const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

const CYCLE_DURATION_HOURS = 24;
const CYCLE_DURATION_MS = CYCLE_DURATION_HOURS * 60 * 60 * 1000;
const BASE_YIELD_PER_HOUR = 350 / 24;

// En atu-mining-api/controllers/userController.js

const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        console.log(`[DIAGNÓSTICO CONTROLLER] /sync recibido. El refCode es: '${refCode}'`);

        if (!telegramId) return res.status(400).json({ message: 'Telegram ID es requerido.' });

        let user = await User.findOne({ telegramId });
        let showWelcome = false;

        // Si el usuario NO existe...
        if (!user) {
            console.log(`[DIAGNÓSTICO CONTROLLER] Usuario nuevo.`);
            showWelcome = true;
            
            const newUser_data = { telegramId, firstName, username, photoUrl, hasSeenWelcome: true };

            if (refCode && refCode !== 'null' && refCode !== 'undefined') {
                console.log(`[DIAGNÓSTICO CONTROLLER] Buscando referente con telegramId: ${refCode}`);
                const referrer = await User.findOne({ telegramId: parseInt(refCode, 10) });

                if (referrer) {
                    console.log(`[DIAGNÓSTICO CONTROLLER] ¡REFERENTE ENCONTRADO! ID de objeto: ${referrer._id}`);
                    newUser_data.referrerId = referrer._id;
                } else {
                    console.error(`[DIAGNÓSTICO CONTROLLER] ¡ERROR! Referente con ID ${refCode} NO FUE ENCONTRADO en la DB.`);
                }
            }
            
            user = new User(newUser_data);
            await user.save();

            if (user.referrerId) {
                await User.updateOne({ _id: user.referrerId }, { $push: { referrals: user._id } });
            }
        
        // <-- 1. ERROR DE SINTAXIS CORREGIDO: SE ELIMINARON LAS LLAVES EXTRA '}}' DE AQUÍ.

        // Si el usuario SÍ existe...
        } else { 
            user.firstName = firstName || user.firstName;
            user.username = username || user.username;
            user.photoUrl = photoUrl || user.photoUrl;
            await user.save();
        }
        
        // --- 2. LÓGICA RESTAURADA: ESTA PARTE AHORA SÍ SE EJECUTARÁ ---
        // Buscamos el usuario de nuevo para obtener los datos populados y enviarlos de vuelta.
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        
        // Verificamos si la populación funcionó
        if (!populatedUser) {
            console.error("Error al popular el usuario después de guardar.");
            return res.status(500).json({ message: 'Error al recuperar datos del usuario.' });
        }

        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        // ¡Se envía la respuesta final y correcta al frontend!
        res.status(200).json(userObject);

    } catch (error) {
        console.error('[DIAGNÓSTICO CONTROLLER] Error fatal en syncUser:', error);
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