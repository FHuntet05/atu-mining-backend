// --- START OF FILE atu-mining-api/controllers/taskController.js (VERSIÓN CORREGIDA Y UNIFICADA) ---

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TASKS = require('../config/tasks');

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

/**
 * Obtiene el estado de todas las tareas para un usuario.
 * Combina la verificación en la base de datos con la verificación en tiempo real (si es necesario).
 */
exports.getTasks = async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Accedemos al bot desde app.locals, donde debería estar la instancia principal de Telegraf.
        const bot = req.app.get('bot');

        const userTasks = await Promise.all(TASKS.map(async (task) => {
            // El estado de completado y reclamado se basa en el array `completedTasks` del usuario.
            const isCompletedAndClaimed = (user.completedTasks || []).includes(task.id);
            let isCompleted = isCompletedAndClaimed;

            // Verificación en tiempo real para la tarea de unirse al grupo, si aún no está completada.
            if (task.type === 'join_group' && !isCompleted && GROUP_CHAT_ID && bot) {
                try {
                    const chatMember = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
                        isCompleted = true; // El usuario está en el grupo, puede reclamar.
                    }
                } catch (e) {
                    // Falla silenciosamente si el bot no puede verificar (ej. el usuario no está en el grupo)
                    console.log(`No se pudo verificar al usuario ${telegramId} en el grupo ${GROUP_CHAT_ID}.`);
                }
            }
            
            // Para otras tareas como 'first_boost' o 'invite_10', la lógica de completado
            // debe ser manejada en sus respectivos flujos (ej. en boostController).
            // Por ahora, asumimos que si no está en `completedTasks`, no está hecha.

            return { 
                ...task, 
                isCompleted, // Indica si la condición se cumple AHORA.
                claimed: isCompletedAndClaimed // Indica si la recompensa ya fue reclamada.
            };
        }));

        res.status(200).json(userTasks);
    } catch (error) {
        console.error("Error en getTasks:", error);
        res.status(500).json({ message: 'Error del servidor al obtener tareas.' });
    }
};

/**
 * Permite a un usuario reclamar la recompensa de una tarea completada.
 */
exports.claimTask = async (req, res) => {
    try {
        const { telegramId, taskId } = req.body;
        const task = TASKS.find(t => t.id === taskId);
        const user = await User.findOne({ telegramId }).populate('referrals');
        if (!user || !task) {
            return res.status(404).json({ message: 'Usuario o tarea no encontrada.' });
        }

        if ((user.completedTasks || []).includes(taskId)) {
            return res.status(400).json({ message: 'Ya has reclamado esta tarea.' });
        }

       // --- LÓGICA DE VERIFICACIÓN ANTES DE PAGAR ---
        if (task.type === 'invite_10') {
            if (user.referrals.length < 10) {
                return res.status(400).json({ message: 'Aún no tienes 10 amigos invitados para reclamar.' });
            }
        }
        // Para "join_group" y otras, no hay verificación, confiamos en el clic del usuario.
        // Aquí se añadirían verificaciones para otros tipos de tareas si fuera necesario.

        user.autBalance += task.reward;
        user.completedTasks.push(taskId);

        await Transaction.create({
            userId: user._id,
            type: 'claim_task',
            currency: 'AUT',
            amount: task.reward,
            status: 'completed',
            details: `Recompensa por tarea: ${task.title}`
        });

        const updatedUser = await user.save();
        
        res.status(200).json({ 
            message: `¡Recompensa de ${task.reward.toLocaleString()} AUT reclamada!`, 
            user: updatedUser 
        });
        
    } catch (error) {
        console.error("Error en claimTask:", error);
        res.status(500).json({ message: 'Error del servidor al reclamar la tarea.' });
    }
};
// --- END OF FILE atu-mining-api/controllers/taskController.js ---