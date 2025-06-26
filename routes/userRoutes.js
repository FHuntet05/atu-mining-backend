// En: atu-mining-backend/routes/userRoutes.js
// CÓDIGO COMPLETO CON LA CORRECCIÓN DEL ERROR DE CAST

const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/sync', async (req, res) => {
  try {
    const { id, username, first_name, photo_url, start_param } = req.body;
    if (!id) return res.status(400).json({ message: 'ID de usuario requerido.' });

    let user = await User.findOne({ telegramId: id });

    if (!user) {
      const referrerTelegramId = start_param ? parseInt(start_param, 10) : null;
      
      user = new User({
        telegramId: id,
        username,
        firstName: first_name,
        photoUrl: photo_url,
        referrerId: (referrerTelegramId && !isNaN(referrerTelegramId)) ? referrerTelegramId : null
      });
      await user.save();

      if (referrerTelegramId && !isNaN(referrerTelegramId)) {
        // --- CORRECCIÓN CLAVE ---
        // Encontramos al referente por su telegramId
        const referrer = await User.findOne({ telegramId: referrerTelegramId });
        if (referrer) {
          // Y añadimos el _id (ObjectId) del nuevo usuario a su lista de referidos.
          referrer.referrals.push(user._id);
          await referrer.save();
        }
      }
    } else {
      // Actualizamos datos si el usuario ya existe
      user.username = username || user.username;
      user.firstName = first_name || user.firstName;
      // La foto se actualiza en el middleware de index.js
      await user.save();
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error en sync:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});
// (El resto de tus userRoutes no necesita cambios)
module.exports = router;