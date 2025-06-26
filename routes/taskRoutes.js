// En: atu-mining-backend/routes/taskRoutes.js
// CÓDIGO COMPLETO Y LIMPIO (SIN MARCADORES DE GIT)

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TASKS = require('../config/tasks');

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;

// Ruta: GET /api/tasks/:telegramId
// Verifica el estado actual de todas las tareas para un usuario
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const bot = req.app.locals.bot;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const userTasks = await Promise.all(TASKS.map(async (task) => {
            let isCompleted = user.completedTasks.includes(task.id);
            
            if (isCompleted) {
                return { ...task, isCompleted: true, claimed: true };
            }

            if (task.type === 'join_group' && GROUP_CHAT_ID) {
                try {
                    const chatMember = await bot.telegram.getChatMember(GROUP_CHAT_ID, telegramId);
                    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
                        isCompleted = true;
                    }
                } catch (e) {
                    console.log(`No se pudo verificar al usuario ${telegramId} en el grupo.`);
                }
            }
            
            if (task.type === 'first_boost') {
                const boostPurchase = await Transaction.findOne({ telegramId: user.telegramId, type: 'purchase' });
                if (boostPurchase) {
                    isCompleted = true;
                }
            }

            if (task.type === 'invite_10') {
                const requiredReferrals = 10;
                if (user.referrals && user.referrals.length >= requiredReferrals) {
                    isCompleted = true;
                }
            }

            return { ...task, isCompleted, claimed: user.completedTasks.includes(task.id) };
        }));
        res.status(200).json(userTasks);
    } catch (error) {
        console.error("Error en GET /api/tasks:", error);
        res.status(500).json({ message: 'Error del servidor al obtener tareas.' });
    }
});

// Ruta: POST /api/tasks/claim
// Permite a un usuario reclamar la recompensa de una tarea completada
router.post('/claim', async (req, res) => {
    try {
        const { telegramId, taskId } = req.body;
        const bot = req.app.locals.bot;
        
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
                return res.status(400).json({ message: 'No se pudo verificar la membresía del grupo.' });
            }
        } else if (task.type === 'first_boost') {
            const boostPurchase = await Transaction.findOne({ telegramId: user.telegramId, type: 'purchase' });
            canClaim = !!boostPurchase;
        } else if (task.type === 'invite_10') {
            const requiredReferrals = 10;
            canClaim = user.referrals && user.referrals.length >= requiredReferrals;
        }

        if (canClaim) {
            user.autBalance += task.reward;
            user.completedTasks.push(taskId);
            
            const newTransaction = new Transaction({
                telegramId: user.telegramId,
                type: 'claim',
                description: `Recompensa: ${task.title}`,
                amount: `+${task.reward} AUT`
            });
            
            await newTransaction.save();
            const updatedUser = await user.save();
            
            res.status(200).json({ message: '¡Recompensa reclamada!', user: updatedUser });
        } else {
            res.status(400).json({ message: 'Aún no cumples los requisitos para reclamar esta recompensa.' });
        }
    } catch (error) {
        console.error("Error en POST /api/tasks/claim:", error);
        res.status(500).json({ message: 'Error del servidor al reclamar la tarea.' });
    }
});

module.exports = router;
