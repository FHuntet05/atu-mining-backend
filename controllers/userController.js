// --- START OF FILE atu-mining-api/controllers/userController.js (FINAL) ---
const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');

const syncUser = async (req, res) => {
    try {
        const tgUserData = req.body;
        if (!tgUserData?.telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }
        
        let user = await User.findOrCreate({
            id: tgUserData.telegramId,
            first_name: tgUserData.firstName,
            username: tgUserData.username,
            photo_url: tgUserData.photoUrl,
        });
        
        user.firstName = tgUserData.firstName || user.firstName;
        user.username = tgUserData.username || user.username;
        user.photoUrl = tgUserData.photoUrl || user.photoUrl;

        let showWelcome = false;
        if (!user.hasSeenWelcome) {
            showWelcome = true;
            user.hasSeenWelcome = true; 
        }

        await user.save();
        
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;
        
        res.status(200).json(userObject);
    } catch (error) {
        console.error('Error fatal en syncUser:', error);
        res.status(500).json({ message: 'Error interno grave al sincronizar el usuario.', details: error.message });
    }
};

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

        const cycleDurationMs = (ECONOMY_CONFIG.CYCLE_DURATION_HOURS || 24) * 60 * 60 * 1000;
        const elapsedTime = Date.now() - new Date(user.lastClaim).getTime();

        if (elapsedTime < cycleDurationMs) {
            return res.status(403).json({ message: 'Aún no puedes reclamar. El ciclo no ha terminado.' });
        }
        
        // La recompensa a dar es la capacidad total del ciclo.
        // Por ahora es fija, pero en el futuro podría incluir boosts.
        const rewardAmount = ECONOMY_CONFIG.DAILY_CLAIM_REWARD || 350;

        user.autBalance += rewardAmount;
        user.lastClaim = new Date(); // ¡CRUCIAL! Esto reinicia el ciclo.

        await user.save();

        // El frontend espera el objeto de usuario actualizado dentro de una clave "user".
        res.status(200).json({
            message: `¡Has reclamado ${rewardAmount} AUT!`,
            user: user
        });

    } catch (error) {
        console.error('Error al reclamar recompensas:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate({ path: 'referrals', select: 'firstName photoUrl' });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        const userObject = user.toObject();
        userObject.config = ECONOMY_CONFIG;
        
        res.status(200).json(userObject);
    } catch (error) {
        console.error('Error en getUserData:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = { syncUser, getUserData , claimRewards };
// --- END OF FILE atu-mining-api/controllers/userController.js (FINAL) ---