const User = require('../models/User');

/**
 * Sincroniza los datos del usuario de Telegram con la base de datos.
 * Si el usuario no existe, lo crea.
 * Si existe, actualiza su información (nombre, foto, etc.).
 */
const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl } = req.body;

        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido' });
        }

        let user = await User.findOne({ telegramId });

        if (user) {
            // El usuario ya existe, actualizamos sus datos por si han cambiado
            user.firstName = firstName || user.firstName;
            user.username = username || user.username;
            user.photoUrl = photoUrl || user.photoUrl;
        } else {
            // El usuario no existe, lo creamos con valores por defecto correctos
            console.log(`Creando nuevo usuario con ID: ${telegramId}`);
            user = new User({
                telegramId,
                firstName: firstName || 'Usuario',
                username,
                photoUrl,
                autBalance: 0,
                usdtBalance: 0,
                usdtForWithdrawal: 0,
                boostYieldPerHour: 350 / 24, // Producción base
                storageCapacity: (350 / 24) * 8, // Capacidad base de 8 horas
                referrals: [], // Este campo es un Array de ObjectIds
                activeReferrals: 0, // Este campo es un Number, se inicializa en 0
                // El campo 'missions' se inicializará con los valores por defecto del Schema.
            });
        }

        // Guardamos los cambios (sea creación o actualización)
        await user.save();
        
        // Devolvemos el usuario completo con sus referidos populados para el frontend
        // Esto es útil para que la página del equipo muestre los nombres y fotos
        const populatedUser = await User.findById(user._id).populate({
            path: 'referrals',
            select: 'firstName photoUrl' // Solo traer estos campos de los referidos
        });
        
        res.status(200).json(populatedUser);

    } catch (error) {
        // Logueamos el error completo para depuración en el servidor
        console.error('Error en syncUser:', error);
        // Enviamos una respuesta de error genérica al cliente
        res.status(500).json({ message: 'Error interno del servidor al sincronizar el usuario.' });
    }
};

/**
 * Obtiene los datos de un usuario por su Telegram ID.
 * Usado por el frontend para recargar los datos del usuario.
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


// Exportamos todas las funciones del controlador para que puedan ser usadas en las rutas
module.exports = {
    syncUser,
    getUserData,
};