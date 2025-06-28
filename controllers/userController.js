// --- START OF FILE atu-mining-backend/controllers/userController.js ---

const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy'); // <-- 1. IMPORTAMOS LA CONFIGURACIÓN

const syncUser = async (req, res) => {
    try {
        const tgUserDataFromFrontend = req.body;
        if (!tgUserDataFromFrontend.telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }
        
        const formattedTgUser = {
            id: tgUserDataFromFrontend.telegramId,
            first_name: tgUserDataFromFrontend.firstName,
            username: tgUserDataFromFrontend.username,
            photo_url: tgUserDataFromFrontend.photoUrl,
        };

        const user = await User.findOrCreate(formattedTgUser);
        
        user.firstName = formattedTgUser.first_name || user.firstName;
        user.username = formattedTgUser.username || user.username;
        user.photoUrl = formattedTgUser.photo_url || user.photoUrl;
        await user.save();
        
        const populatedUser = await User.findById(user._id).populate({
            path: 'referrals', select: 'firstName photoUrl'
        });

        // --- INICIO DE LA MODIFICACIÓN CLAVE ---

        // 2. Convertimos el documento de Mongoose a un objeto plano
        const userObject = populatedUser.toObject();

        // 3. Adjuntamos la configuración de la economía al objeto del usuario
        userObject.config = ECONOMY_CONFIG;

        // 4. Enviamos el objeto combinado al frontend
        res.status(200).json(userObject);

        // --- FIN DE LA MODIFICACIÓN CLAVE ---

    } catch (error) {
        console.error('Error en syncUser:', error);
        res.status(500).json({ message: 'Error interno al sincronizar el usuario.' });
    }
};

const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate({
            path: 'referrals', select: 'firstName photoUrl autBalance'
        });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        // También podemos añadir la config aquí por consistencia si fuera necesario
        const userObject = user.toObject();
        userObject.config = ECONOMY_CONFIG;

        res.status(200).json(userObject);
    } catch (error) {
        console.error('Error en getUserData:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = { syncUser, getUserData };
// --- END OF FILE atu-mining-backend/controllers/userController.js ---