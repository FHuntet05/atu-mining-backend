const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TASKS = require('../config/tasks');

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

// Pasa la instancia del bot a la ruta
router.use((req, res, next) => {
    req.bot = req.app.locals.bot;
    next();
});

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const userTasks = await Promise.all(TASKS.map(async (task) => {
            let isCompleted = (user.completedTasks || []).includes(task.id);
            if (task.type === 'join_group' && !isCompleted && GROUP_CHAT_ID) {
                try {
                    // Ahora req.bot está disponible
                    const member = await req.bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    isCompleted = ['member', 'administrator', 'creator'].includes(member.status);
                } catch (e) { /* Falla silenciosamente si el usuario no está */ }
            }
            return { ...task, isCompleted, claimed: (user.completedTasks || []).includes(task.id) };
        }));
        res.status(200).json(userTasks);
    } catch (error) {
        console.error("Error en GET /api/tasks:", error);
        res.status(500).json({ message: 'Error al obtener tareas.' });
    }
});

router.post('/claim', async (req, res) => {
    try {
        const { telegramId, taskId } = req.body;
        const user = await User.findOne({ telegramId });
        const task = TASKS.find(t => t.id === taskId);

        if (!user || !task) return res.status(404).json({ message: 'Usuario o tarea no encontrada.' });
        if ((user.completedTasks || []).includes(taskId)) return res.status(400).json({ message: 'Ya has reclamado esta tarea.' });

        user.autBalance += task.reward;
        user.completedTasks.push(taskId);

        await Transaction.create({
            userId: user._id,
            type: 'claim_task',
            currency: 'AUT',
            amount: task.reward, // Es un número
            status: 'completed',
            details: `Recompensa por tarea: ${task.title}`
        });

        const updatedUser = await user.save();
        res.status(200).json({ message: `¡Recompensa reclamada!`, user: updatedUser });
    } catch (error) {
        console.error("Error en POST /api/tasks/claim:", error);
        res.status(500).json({ message: 'Error al reclamar la tarea.' });
    }
});

module.exports = router;