const User = require('../models/User');

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
        
        res.status(200).json(populatedUser);

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
        res.status(200).json(user);
    } catch (error) {
        console.error('Error en getUserData:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = { syncUser, getUserData };