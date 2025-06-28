// --- START OF FILE atu-mining-api/controllers/userController.js (COMPLETO CON TELEMETRÍA) ---

const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');

const syncUser = async (req, res) => {
    console.log('➡️ [BACKEND] 1. Endpoint /api/users/sync ALCANZADO.');
    console.log('     -> Body de la petición entrante:', JSON.stringify(req.body, null, 2));

    try {
        const tgUserData = req.body;
        if (!tgUserData?.telegramId) {
            console.error('❌ [BACKEND] ERROR DE VALIDACIÓN: Falta telegramId en la petición.');
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }
        
        const findOrCreatePayload = {
            id: tgUserData.telegramId,
            first_name: tgUserData.firstName,
            username: tgUserData.username,
            photo_url: tgUserData.photoUrl,
        };

        console.log('➡️ [BACKEND] 2. Intentando encontrar o crear usuario en la BD con estos datos:', findOrCreatePayload);
        
        let user = await User.findOrCreate(findOrCreatePayload);
        
        console.log(`✅ [BACKEND] 3. Usuario encontrado o creado. ID de DB: ${user._id}`);

        user.firstName = tgUserData.firstName || user.firstName;
        user.username = tgUserData.username || user.username;
        user.photoUrl = tgUserData.photoUrl || user.photoUrl;

        let showWelcome = false;
        if (!user.hasSeenWelcome) {
            console.log('     -> Flag de bienvenida detectado. El usuario verá el modal.');
            showWelcome = true;
            user.hasSeenWelcome = true; 
        }

        await user.save();
        console.log('✅ [BACKEND] 4. Datos del usuario guardados/actualizados en la BD.');
        
        const populatedUser = await User.findById(user._id).populate({ path: 'referrals', select: 'firstName photoUrl' });
        const userObject = populatedUser.toObject();
        
        userObject.config = ECONOMY_CONFIG;
        userObject.showWelcomeModal = showWelcome;

        console.log('➡️ [BACKEND] 5. Preparando y enviando respuesta final al frontend.');
        res.status(200).json(userObject);
        console.log('✅ [BACKEND] 6. Respuesta 200 OK enviada exitosamente.');

    } catch (error) {
        console.error('❌ [BACKEND] ERROR FATAL DENTRO DEL BLOQUE CATCH EN SYNCUSER:', error);
        res.status(500).json({ message: 'Error interno grave al sincronizar el usuario.', details: error.message });
    }
};

const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) })
                                 .populate({ path: 'referrals', select: 'firstName photoUrl autBalance' });

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

// --- END OF FILE atu-mining-api/controllers/userController.js (COMPLETO CON TELEMETRÍA) ---