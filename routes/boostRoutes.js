// En: atu-mining-backend/routes/boostRoutes.js
// CÓDIGO COMPLETO Y CORREGIDO

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const boostsConfig = require('../config/boosts');

// GET /api/boosts - Envía la lista de boosts al frontend
router.get('/', (req, res) => {
  // Enviamos la configuración de boosts tal cual
  res.status(200).json(boostsConfig);
});

// POST /api/boosts/purchase - Procesa la compra de un boost
router.post('/purchase', async (req, res) => {
  try {
    const { telegramId, boostId } = req.body;

    if (!telegramId || !boostId) {
      return res.status(400).json({ message: 'Faltan datos requeridos (telegramId, boostId).' });
    }

    const selectedBoost = boostsConfig.find(b => b.id === boostId);
    if (!selectedBoost) {
      return res.status(404).json({ message: 'El boost seleccionado no existe.' });
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    
    // Usamos 'price' del boost para la comparación
    if (user.usdtBalance < selectedBoost.price) {
      return res.status(403).json({ message: 'Fondos USDT insuficientes.' });
    }

    // Procesamos la transacción
    user.usdtBalance -= selectedBoost.price;
    // Usamos 'yieldIncrease' (calculado por hora) para actualizar al usuario
    user.boostYieldPerHour += selectedBoost.yieldIncrease;

    const newTransaction = new Transaction({
      telegramId: user.telegramId,
      type: 'purchase',
      description: `Compra: ${selectedBoost.title}`,
      amount: `-${selectedBoost.price.toFixed(2)} USDT`,
    });

    await user.save();
    await newTransaction.save();
    
    res.status(200).json({ message: '¡Compra realizada con éxito!', user });

  } catch (error) {
    console.error('Error en /api/boosts/purchase:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
