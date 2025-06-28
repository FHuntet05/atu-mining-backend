// --- START OF FILE atu-mining-api/controllers/userController.js (LIMPIO) ---
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

const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate({ path: 'referrals', select: 'firstName photoUrl autBalance' });

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

module.exports = { syncUser, getUserData };
// --- END OF FILE atu-mining-api/controllers/userController.js (LIMPIO) ---