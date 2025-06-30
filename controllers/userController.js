// --- START OF FILE atu-mining-api/controllers/userController.js (VERSIÓN A PRUEBA DE BALAS) ---

const User = require('../models/User');
const ECONOMY_CONFIG = require('../config/economy');
const Transaction = require('../models/Transaction');

// --- FUNCIÓN SYNCUSER "BARE-BONES" ---
// Solo hace lo esencial: registrar al referido y enviar una respuesta simple.
const syncUser = async (req, res) => {
    try {
        const { telegramId, firstName, username, photoUrl, refCode } = req.body;
        
        console.log(`[Sync-BareBones] Petición para ${telegramId}, refCode: '${refCode}'`);

        if (!telegramId) {
            return res.status(400).json({ message: 'Telegram ID es requerido.' });
        }

        let user = await User.findOne({ telegramId });

        // Si el usuario no existe, es un nuevo registro
        if (!user) {
            console.log(`[Sync-BareBones] Usuario nuevo.`);
            
            const newUser_data = { telegramId, firstName, username, photoUrl, hasSeenWelcome: true };
            let referrer = null;

            if (refCode && refCode !== 'null' && refCode !== 'undefined') {
                referrer = await User.findOne({ telegramId: parseInt(refCode, 10) });
                if (referrer) {
                    console.log(`[Sync-BareBones] Referente encontrado.`);
                    newUser_data.referrerId = referrer._id;
                }
            }
            
            // Paso 1: Crear y guardar al nuevo usuario.
            user = new User(newUser_data);
            await user.save();
            console.log(`[Sync-BareBones] Nuevo usuario creado.`);

            // Paso 2: Actualizar al referente.
            if (referrer) {
                await User.updateOne(
                    { _id: referrer._id },
                    { $push: { referrals: user._id } }
                );
                console.log(`[Sync-BareBones] Referente actualizado.`);
            }
        } else { // Usuario existente
             user.firstName = firstName || user.firstName;
             user.username = username || user.username;
             user.photoUrl = photoUrl || user.photoUrl;
             await user.save();
        }
        
        // Enviamos una respuesta simple para confirmar que todo funcionó.
        // El frontend tendrá que volver a solicitar los datos del usuario para actualizar la UI.
        return res.status(200).json({ success: true, message: "Sincronización completada." });

    } catch (error) {
        console.error('[Sync-BareBones] ERROR FATAL:', error);
        return res.status(500).json({ message: 'Error interno del servidor.', details: error.message });
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