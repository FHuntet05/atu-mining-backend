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
    // --- SONDA DE INICIO ---
    console.log(`[CLAIM] Petición de reclamación recibida para telegramId: ${req.body.telegramId}`);

    try {
        const { telegramId } = req.body;
        if (!telegramId) {
            console.error('[CLAIM_ERROR] No se proporcionó Telegram ID.');
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }

        const user = await User.findOne({ telegramId });
        if (!user) {
            console.error(`[CLAIM_ERROR] Usuario no encontrado con ID: ${telegramId}`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        // --- SONDA DE ESTADO INICIAL ---
        console.log(`[CLAIM] Usuario encontrado. Balance AUT actual: ${user.autBalance}. Último reclamo: ${user.lastClaim}`);
//AQUUIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
        const cycleDurationMs = 0.000016 * 60 * 60 * 1000;
        const elapsedTime = Date.now() - new Date(user.lastClaim).getTime();

        if (elapsedTime < cycleDurationMs) {
            console.warn(`[CLAIM_WARN] Intento de reclamo prematuro. Tiempo restante: ${cycleDurationMs - elapsedTime}ms`);
            return res.status(403).json({ message: 'Aún no puedes reclamar. El ciclo no ha terminado.' });
        }
        
        const rewardAmount = ECONOMY_CONFIG.DAILY_CLAIM_REWARD || 350;
        
        // --- SONDA DE CÁLCULO ---
        console.log(`[CLAIM] Calculando recompensa. Monto: ${rewardAmount}. Tipo de dato de rewardAmount: ${typeof rewardAmount}`);
        console.log(`[CLAIM] Tipo de dato de user.autBalance: ${typeof user.autBalance}`);

        // Actualización en memoria
        user.autBalance += rewardAmount;
        user.lastClaim = new Date();

        // --- SONDA PRE-GUARDADO ---
        console.log(`[CLAIM] Balance actualizado en memoria. Nuevo AUT: ${user.autBalance}. Nueva fecha de reclamo: ${user.lastClaim}`);
        
        // El momento de la verdad
        await user.save();

        // --- SONDA POST-GUARDADO ---
        console.log('[CLAIM] ¡ÉXITO! El usuario ha sido guardado en la base de datos.');

        res.status(200).json({
            message: `¡Has reclamado ${rewardAmount} AUT!`,
            user: user
        });

    } catch (error) {
        // --- SONDA DE ERROR CATASTRÓFICO ---
        console.error('[CLAIM_FATAL_ERROR] Ha ocurrido un error en el bloque try-catch:', error);
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