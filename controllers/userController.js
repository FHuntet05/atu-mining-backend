const User = require('../models/User');

/**
 * Sincroniza los datos del usuario de Telegram con la base de datos.
 * Esta función es llamada por el frontend cada vez que la Mini App se abre.
 * Usa el método centralizado User.findOrCreate para evitar inconsistencias.
 */
const syncUser = async (req, res) => {
    try {
        // Obtenemos los datos enviados por el frontend
        const tgUserDataFromFrontend = req.body;

        // Validamos que la información esencial (telegramId) esté presente
        if (!tgUserDataFromFrontend.telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido en la petición.' });
        }
        
        // El método findOrCreate espera un objeto con el formato de la API de Telegram.
        // Lo formateamos aquí para mantener la consistencia.
        const formattedTgUser = {
            id: tgUserDataFromFrontend.telegramId,
            first_name: tgUserDataFromFrontend.firstName,
            username: tgUserDataFromFrontend.username,
            photo_url: tgUserDataFromFrontend.photoUrl,
        };

        // Usamos nuestro nuevo y robusto método centralizado para encontrar o crear el usuario.
        // La lógica de creación está ahora segura dentro del modelo.
        const user = await User.findOrCreate(formattedTgUser);

        // Una vez que tenemos el usuario (sea nuevo o existente), actualizamos sus datos
        // por si han cambiado en Telegram (nombre, foto, etc.).
        user.firstName = formattedTgUser.first_name || user.firstName;
        user.username = formattedTgUser.username || user.username;
        user.photoUrl = formattedTgUser.photo_url || user.photoUrl;
        await user.save(); // Guardamos los cambios.
        
        // Devolvemos el documento del usuario completo, incluyendo la lista de referidos
        // con sus nombres y fotos para la página del equipo.
        const populatedUser = await User.findById(user._id).populate({
            path: 'referrals',
            select: 'firstName photoUrl'
        });
        
        res.status(200).json(populatedUser);

    } catch (error) {
        console.error('Error en syncUser:', error);
        res.status(500).json({ message: 'Error interno del servidor al sincronizar el usuario.' });
    }
};

/**
 * Obtiene los datos de un usuario por su Telegram ID.
 * Esta función no ha cambiado, pero la dejamos aquí para mantener el controlador completo.
 */
const getUserData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido' });
        }

        const user = await User.findOne({ telegramId }).populate({
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

// Exportamos las funciones para que puedan ser usadas en el archivo de rutas.
module.exports = {
    syncUser,
    getUserData,
};