// En: atu-mining-backend/routes/boostRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const boostsConfig = require('../config/boosts');

// GET /api/boosts/ - Endpoint para que el frontend obtenga la lista de boosts
router.get('/', (req, res) => {
  res.status(200).json(boostsConfig);
});

// POST /api/boosts/purchase - Endpoint para comprar un boost
router.post('/purchase', async (req, res) => {
  try {
    const { telegramId, boostId } = req.body;

    // 1. Validar la entrada
    if (!telegramId || !boostId) {
      return res.status(400).json({ message: 'Faltan telegramId o boostId.' });
    }

    // 2. Encontrar el boost en nuestra configuración
    const selectedBoost = boostsConfig.find(b => b.id === boostId);
    if (!selectedBoost) {
      return res.status(404).json({ message: 'El boost seleccionado no existe.' });
    }

    // 3. Encontrar al usuario
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // 4. Verificar si el usuario tiene saldo USDT suficiente
    if (user.usdtBalance < selectedBoost.cost) {
      return res.status(403).json({ message: 'Fondos USDT insuficientes para realizar la compra.' });
    }

    // 5. Procesar la transacción
    user.usdtBalance -= selectedBoost.cost;
    user.boostYieldPerHour += selectedBoost.yieldIncrease;

    // 6. Crear un registro de la transacción (siguiendo tu formato)
    const newTransaction = new Transaction({
      telegramId: user.telegramId,
      type: 'purchase',
      description: `Compra de boost: ${selectedBoost.name}`,
      // Usamos el mismo formato que en tu comando /approve para consistencia
      amount: `-${selectedBoost.cost.toFixed(2)} USDT`, 
    });

    // 7. Guardar los cambios en la base de datos
    await user.save();
    await newTransaction.save();
    
    // 8. Enviar respuesta exitosa con los datos del usuario actualizados
    res.status(200).json({ message: '¡Boost comprado con éxito!', user });

  } catch (error) {
    console.error('Error en la compra del boost:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
