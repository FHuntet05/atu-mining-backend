// En: atu-mining-backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/sync', async (req, res) => {
  try {
    const { id, username, first_name, photo_url, start_param } = req.body;
    if (!id) return res.status(400).json({ message: 'ID de usuario requerido.' });

    let user = await User.findOne({ telegramId: id });

    if (!user) {
      const referrerId = start_param ? parseInt(start_param, 10) : null;
      
      user = new User({
        telegramId: id,
        username: username,
        firstName: first_name,
        photoUrl: photo_url,
        referrerId: referrerId
      });
      await user.save();

      if (referrerId && !isNaN(referrerId)) {
        await User.updateOne({ telegramId: referrerId }, { $addToSet: { referrals: id } });
      }

    } else {
      user.username = username || user.username;
      user.firstName = first_name || user.firstName;
      user.photoUrl = photo_url || user.photoUrl;
      await user.save();
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error en sync:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
