const User = require('../models/User');

/**
 * Sincroniza los datos del usuario. Es el punto de entrada principal para el frontend.
 * Contiene la lógica del "Test de la Verdad" para verificar la versión del backend.
 */
const syncUser = async (req, res) => {
    try {
        const tgUserDataFromFrontend = req.body;

        if (!tgUserDataFromFrontend.telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido en la petición.' });
        }
        
        // Formateamos el objeto para que coincida con lo que espera el método findOrCreate.
        const formattedTgUser = {
            id: tgUserDataFromFrontend.telegramId,
            first_name: tgUserDataFromFrontend.firstName,
            username: tgUserDataFromFrontend.username,
            photo_url: tgUserDataFromFrontend.photoUrl,
        };

        // Usamos nuestro método centralizado para encontrar o crear al usuario.
        const user = await User.findOrCreate(formattedTgUser);

        // Actualizamos los datos del perfil por si han cambiado en Telegram.
        user.firstName = formattedTgUser.first_name || user.firstName;
        user.username = formattedTgUser.username || user.username;
        user.photoUrl = formattedTgUser.photo_url || user.photoUrl;
        await user.save();
        
        // Populamos los referidos para tener la información completa.
        const populatedUser = await User.findById(user._id).populate({
            path: 'referrals',
            select: 'firstName photoUrl'
        });
        
        if (!populatedUser) {
            return res.status(404).json({ message: 'No se pudo encontrar al usuario después de la creación.' });
        }

        // --- INICIO DEL TEST DE LA VERDAD ---
        // Convertimos el documento de Mongoose a un objeto plano para poder añadirle una propiedad.
        const userObject = populatedUser.toObject();
        // Añadimos nuestra marca de versión para verificar el despliegue.
        userObject.backendVersion = 'V_BACKEND_FIX_SYNTAX_FINAL';
        // --- FIN DEL TEST DE LA VERDAD ---
        
        // Enviamos el objeto modificado que incluye nuestra marca de versión.
        res.status(200).json(userObject);

    } catch (error) {
        console.error("❌ Error grave en syncUser:", error);
        res.status(500).json({ message: 'Error interno del servidor al sincronizar el usuario.' });
    }
};

/**
 * Obtiene los datos de un usuario (no ha cambiado, pero se incluye para que el archivo esté completo).
 */
const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido' });
        }

        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate({
            path: 'referrals',
            select: 'firstName photoUrl autBalance'
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error en getUserData:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = {
    syncUser,
    getUserData,
};