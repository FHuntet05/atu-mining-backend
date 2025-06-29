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
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }
        
        // Usamos una sesión de Mongoose para asegurar que ambas operaciones (crear y actualizar)
        // se completen exitosamente, o ninguna lo haga (atomicidad).
        const session = await User.startSession();
        let user;
        
        await session.withTransaction(async () => {
            user = await User.findOne({ telegramId }).session(session);
            let showWelcome = false;

            if (!user) { // Es un usuario nuevo
                user = new User({ telegramId, firstName, username, photoUrl, hasSeenWelcome: true });
                showWelcome = true;

                if (refCode) {
                    const referrer = await User.findOne({ telegramId: parseInt(refCode, 10) }).session(session);
                    if (referrer) {
                        user.referrerId = referrer._id;
                        // Usamos $push directamente en la actualización del referente
                        referrer.referrals.push(user._id);
                        await referrer.save({ session });
                    }
                }
                await user.save({ session });
            } else { // Es un usuario existente
                user.firstName = firstName || user.firstName;
                user.username = username || user.username;
                user.photoUrl = photoUrl || user.photoUrl;
                await user.save({ session });
            }
        });

        session.endSession();

        // Después de la transacción, obtenemos los datos completos para enviar al frontend
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = !user.hasSeenWelcome;
        
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