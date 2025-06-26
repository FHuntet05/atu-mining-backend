const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TASKS = require('../config/tasks'); // Mantenemos tu configuración de tareas

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

/**
 * Obtiene el estado de todas las tareas para un usuario, verificando contra el modelo 'missions'.
 */
exports.getTasks = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const bot = req.app.locals.bot;
        const user = await User.findOne({ telegramId });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const userTasks = await Promise.all(TASKS.map(async (task) => {
            let isCompleted = false;
            let claimed = false; // El estado 'claimed' también se deriva de 'missions'

            // --- INICIO DE LA LÓGICA CORREGIDA ---
            // Verificamos el estado usando el objeto 'user.missions' que sí existe
            switch (task.type) {
                case 'join_group':
                    isCompleted = user.missions.joinedGroup;
                    claimed = user.missions.joinedGroup;
                    break;
                case 'first_boost':
                    isCompleted = user.missions.firstBoostPurchased;
                    claimed = user.missions.firstBoostPurchased;
                    break;
                case 'invite_10':
                    isCompleted = (user.missions.invitedUsersCount || 0) >= 10;
                    claimed = user.missions.claimedInviteReward;
                    break;
                default:
                    break;
            }
            // --- FIN DE LA LÓGICA CORREGIDA ---

            // Mantenemos tu lógica de verificación en tiempo real, ¡es una buena idea!
            if (task.type === 'join_group' && !isCompleted && GROUP_CHAT_ID) {
                try {
                    const chatMember = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
                        isCompleted = true;
                        // Si lo encontramos, lo actualizamos para futuras consultas
                        if (!user.missions.joinedGroup) {
                            user.missions.joinedGroup = true;
                            await user.save();
                        }
                    }
                } catch (e) {
                    console.log(`No se pudo verificar al usuario ${telegramId} en el grupo.`);
                }
            }
            
            return { ...task, isCompleted, claimed };
        }));

        res.status(200).json(userTasks);
    } catch (error) {
        console.error("Error en GET /api/tasks:", error);
        res.status(500).json({ message: 'Error del servidor al obtener tareas.' });
    }
};

/**
 * Permite a un usuario reclamar la recompensa de una tarea.
 * Esta lógica es compleja y depende de cómo se completan las tareas.
 * En nuestro modelo, la mayoría de las recompensas se dan automáticamente.
 */
exports.claimTask = async (req, res) => {
    try {
        // La lógica de reclamo manual es compleja con el modelo actual, ya que las recompensas
        // se otorgan automáticamente cuando se completa una misión (ej. al unirse a un grupo,
        // al comprar un boost, o al llegar al 10º referido).
        
        // Esta ruta podría usarse en el futuro para tareas que requieran un clic explícito para reclamar.
        
        return res.status(400).json({ message: 'Las recompensas de las tareas se otorgan automáticamente al completarlas.' });

    } catch (error) {
        console.error("Error en POST /api/tasks/claim:", error);
        res.status(500).json({ message: 'Error del servidor al reclamar la tarea.' });
    }
};