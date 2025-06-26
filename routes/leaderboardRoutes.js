// En: atu-mining-backend/routes/leaderboardRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
    try {
        const topUsers = await User.find({})
            .sort({ totalMinedAUT: -1 })
            .limit(20)
            .select('firstName photoUrl totalMinedAUT');

        res.status(200).json(topUsers);
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar la tabla de líderes.' });
    }
});
module.exports = router;