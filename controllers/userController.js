// atu-mining-api/controllers/userController.js (VERSIÓN SIMPLE Y CORRECTA)
const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

const CYCLE_DURATION_HOURS = 24;
const CYCLE_DURATION_MS = CYCLE_DURATION_HOURS * 60 * 60 * 1000;
const BASE_YIELD_PER_HOUR = 350 / 24;

const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }
        
        let user = await User.findOne({ telegramId });
        let showWelcome = false;

        if (!user) { // Es un usuario nuevo
            console.log(`[Sync] Usuario nuevo detectado: ${telegramId}. Creando...`);
            user = new User({
                telegramId,
                firstName,
                username,
                photoUrl,
                hasSeenWelcome: true // Lo marcamos como visto para que el modal aparezca
            });
            showWelcome = true; // El modal de bienvenida solo se muestra a usuarios nuevos

            // Si el nuevo usuario tiene un código de referido, lo asignamos.
            if (refCode) {
                const referrer = await User.findOne({ telegramId: parseInt(refCode, 10) });
                if (referrer) {
                    user.referrerId = referrer._id;
                    console.log(`[Sync] Referente ${referrer.telegramId} encontrado para el nuevo usuario.`);
                }
            }
            // Guardamos al nuevo usuario
            await user.save();
            
            // --- ACTUALIZACIÓN DEL REFERENTE (Paso separado y seguro) ---
            if (user.referrerId) {
                await User.updateOne(
                    { _id: user.referrerId },
                    { $push: { referrals: user._id } }
                );
                console.log(`[Sync] Lista de referidos del referente actualizada.`);
            }

        } else { // Es un usuario existente
            user.firstName = firstName || user.firstName;
            user.username = username || user.username;
            user.photoUrl = photoUrl || user.photoUrl;
            await user.save();
        }
        
        // Obtenemos los datos finales para enviar al frontend
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        res.status(200).json(userObject);

    } catch (error) {
        console.error('Error fatal en syncUser:', error);
        res.status(500).json({ message: 'Error interno grave al sincronizar.', details: error.message });
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