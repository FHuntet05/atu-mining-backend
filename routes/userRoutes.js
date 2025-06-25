// En: atu-mining-backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Importamos el Modelo que creamos antes

// La ruta será: POST /api/users/sync
// "Sync" porque sincroniza el estado del usuario de Telegram con nuestra base de datos.
router.post('/sync', async (req, res) => {
  try {
    // 1. Extraemos los datos del usuario que el frontend nos envía en el cuerpo (body) de la petición.
    const { id, username, first_name } = req.body;

    // Verificación de seguridad básica: necesitamos el ID.
    if (!id) {
      return res.status(400).json({ message: 'El ID de usuario de Telegram es requerido.' });
    }

    // 2. Buscamos en la base de datos si ya existe un usuario con ese ID.
    let user = await User.findOne({ telegramId: id });

    // 3. Si el usuario NO existe...
    if (!user) {
      console.log(`Usuario con ID ${id} no encontrado. Creando nuevo usuario...`);
      // Lo creamos usando nuestro Modelo 'User'.
      user = new User({
        telegramId: id,
        username: username || `user_${id}`,
        // Mongoose usará los valores por defecto que definimos en el Schema
        // (usdtBalance: 0, autBalance: 0, etc.)
      });
      // Guardamos el nuevo usuario en la base de datos.
      await user.save();
      console.log(`✅ Nuevo usuario "${user.username}" creado con éxito.`);
    } else {
      // Si el usuario SÍ existe, simplemente lo mostramos en la consola.
      console.log(`✅ Usuario "${user.username}" encontrado en la base de datos.`);
    }

    // 4. Devolvemos el perfil completo del usuario (ya sea el nuevo o el existente) al frontend.
    res.status(200).json(user);

  } catch (error) {
    console.error('❌ Error en la sincronización de usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Exportamos el router para poder usarlo en nuestro archivo principal.
module.exports = router;