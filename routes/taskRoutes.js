// En: atu-mining-backend/routes/taskRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
// Ya no importamos Telegraf aquí

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

const TASKS = [
    { id: 1, title: 'Únete a nuestro grupo', reward: 500, type: 'join_group', link: 'https://t.me/+HxX28_Pvwqo3YTYx' },
    { id: 2, title: 'Compra tu primer Boost', reward: 1000, type: 'first_boost' },
    { id: 3, title: 'Invita a 10 Amigos activos', reward: 1000, type: 'invite_10' },
];

// Ruta: GET /api/tasks/:telegramId
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const bot = req.app.locals.bot; // Obtenemos la instancia del bot desde la app
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const userTasks = await Promise.all(TASKS.map(async (task) => {
            let isCompleted = user.completedTasks.includes(task.id);
            if (!isCompleted && task.type === 'join_group' && GROUP_CHAT_ID) {
                try {
                    const chatMember = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
                        isCompleted = true;
                    }
                } catch (e) { console.log(`No se pudo verificar al usuario ${telegramId} en el grupo.`); }
            }
            return { ...task, isCompleted, claimed: user.completedTasks.includes(task.id) };
        }));
        res.status(200).json(userTasks);
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// Ruta: POST /api/tasks/claim
router.post('/claim', async (req, res) => {
    try {
        const { telegramId, taskId } = req.body;
        const bot = req.app.locals.bot; // Obtenemos la instancia del bot desde la app
        const user = await User.findOne({ telegramId });
        const task = TASKS.find(t => t.id === taskId);

        if (!user || !task) return res.status(404).json({ message: 'Usuario o tarea no encontrada.' });
        if (user.completedTasks.includes(taskId)) return res.status(400).json({ message: 'Ya has reclamado esta tarea.' });

        let canClaim = false;
        if (task.type === 'join_group') {
            try {
                const chatMember = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                canClaim = ['member', 'administrator', 'creator'].includes(chatMember.status);
            } catch {
                return res.status(400).json({ message: 'No se pudo verificar la membresía.' });
            }
        }
        // ... Lógica para otras tareas

        if (canClaim) {
            user.autBalance += task.reward;
            user.completedTasks.push(taskId);
            const updatedUser = await user.save();
            const newTransaction = new Transaction({ telegramId, type: 'claim', description: `Recompensa: ${task.title}`, amount: `+${task.reward} AUT` });
            await newTransaction.save();
            res.status(200).json({ message: '¡Recompensa reclamada!', user: updatedUser });
        } else {
            res.status(400).json({ message: 'Aún no cumples los requisitos.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;
