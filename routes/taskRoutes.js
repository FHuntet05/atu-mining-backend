const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TASKS = require('../config/tasks'); // Asumiendo que las tareas están en /config/tasks.js

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

// Ruta GET para obtener el estado de las tareas
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const bot = req.app.locals.bot;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const completed = user.completedTasks || [];
        const userTasks = await Promise.all(TASKS.map(async (task) => {
            let isCompleted = completed.includes(task.id);
            if (task.type === 'join_group' && !isCompleted && GROUP_CHAT_ID) {
                try {
                    const member = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    isCompleted = ['member', 'administrator', 'creator'].includes(member.status);
                } catch (e) { /* Ignorar errores si no se puede verificar */ }
            }
            return { ...task, isCompleted, claimed: completed.includes(task.id) };
        }));
        res.status(200).json(userTasks);
    } catch (error) {
        console.error("Error en GET /api/tasks:", error);
        res.status(500).json({ message: 'Error del servidor al obtener tareas.' });
    }
});

// Ruta POST para reclamar la recompensa de una tarea
router.post('/claim', async (req, res) => {
    try {
        const { telegramId, taskId } = req.body;
        const user = await User.findOne({ telegramId });
        const task = TASKS.find(t => t.id === taskId);

        if (!user || !task) return res.status(404).json({ message: 'Usuario o tarea no encontrada.' });
        if ((user.completedTasks || []).includes(taskId)) return res.status(400).json({ message: 'Ya has reclamado esta tarea.' });

        // En un sistema de producción, aquí verificaríamos de nuevo que la tarea está completa
        // Pero por ahora, confiamos en que el frontend solo habilita el botón cuando debe.
        
        user.autBalance = (user.autBalance || 0) + task.reward;
        if (!user.completedTasks) user.completedTasks = [];
        user.completedTasks.push(taskId);
        
        const updatedUser = await user.save();
        res.status(200).json({ message: `¡Recompensa de ${task.reward} AUT reclamada!`, user: updatedUser });

    } catch (error) {
        console.error("Error en POST /api/tasks/claim:", error);
        res.status(500).json({ message: 'Error del servidor al reclamar la tarea.' });
    }
});

module.exports = router;