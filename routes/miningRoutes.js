// En: atu-mining-backend/routes/miningRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const ENERGY_CAPACITY_HOURS = 8;
const CYCLE_DURATION_MS = ENERGY_CAPACITY_HOURS * 60 * 60 * 1000;
const FREE_TIER_YIELD_PER_HOUR = 350 / 24;

router.post('/claim', async (req, res) => {
    try {
        const { telegramId } = req.body;
        if (!telegramId) return res.status(400).json({ message: 'telegramId es requerido.' });

        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const elapsedTime = Date.now() - new Date(user.lastClaim).getTime();
        const cappedElapsedTime = Math.min(elapsedTime, CYCLE_DURATION_MS);
        const totalYieldPerHour = FREE_TIER_YIELD_PER_HOUR + user.boostYieldPerHour;
        const reward = (cappedElapsedTime / (3600 * 1000)) * totalYieldPerHour;

        if (reward < 0.0001) return res.status(400).json({ message: 'No hay suficiente recompensa para reclamar.' });

        user.autBalance += reward;
        user.totalMinedAUT += reward;
        user.lastClaim = new Date();
        const updatedUser = await user.save();

        const newTransaction = new Transaction({
            telegramId: user.telegramId, type: 'claim',
            description: 'Reclamo de Minería', amount: `+${reward.toFixed(0)} AUT`
        });
        await newTransaction.save();
        
        res.status(200).json({ message: 'Recompensa reclamada.', user: updatedUser });
    } catch (error) {
        console.error('Error al reclamar:', error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});
module.exports = router;
