// atu-mining-api/services/boost.service.js (VERSIÓN FINAL Y CORRECTA)

const mongoose = require('mongoose');
const User = require('../models/User');
const ActiveBoost = require('../models/ActiveBoost');
const Transaction = require('../models/Transaction');
const BOOSTS_CONFIG = require('../config/boosts');
const TASKS_CONFIG = require('../config/tasks');

async function grantBoostsToUser({ userId, boostId, quantity, session, purchaseMethod = 'crypto', totalCost = 0 }) {
    
    // --- BÚSQUEDA POR ID DE TEXTO (LÓGICA CORRECTA) ---
    const boostToBuy = BOOSTS_CONFIG.find(b => b.id === boostId);
    
    // --- VALIDACIÓN CORRECTA ---
    if (!boostToBuy) {
        // Obtenemos los IDs de texto válidos para el mensaje de error
        const validIds = BOOSTS_CONFIG.map(b => b.id).join(', ');
        // Este es el error que deberías ver si el ID es incorrecto
        throw new Error(`El ID de Boost "${boostId}" no es válido. Los IDs válidos son: ${validIds}`);
    }

    const user = await User.findById(userId).session(session);
    if (!user) throw new Error(`Usuario no encontrado para la asignación de boost: ${userId}`);
    
    // --- LÓGICA DE LA MISIÓN "PRIMER BOOST" ---
    const firstBoostTask = TASKS_CONFIG.find(t => t.type === 'first_boost');
    if (firstBoostTask && !user.completedTasks.includes(String(firstBoostTask.id))) {
        user.autBalance += firstBoostTask.reward;
        user.completedTasks.push(String(firstBoostTask.id));
        
        await Transaction.create([{
            userId: user._id,
            type: 'claim_task',
            currency: 'AUT',
            amount: firstBoostTask.reward,
            status: 'completed',
            details: `Recompensa por tarea: ${firstBoostTask.title}`
        }], { session });
    }

    if (purchaseMethod === 'balance') {
        if (user.usdtBalance < totalCost) throw new Error('Saldo insuficiente para la compra.');
        user.usdtBalance -= totalCost;
    }

    // --- ASIGNACIÓN DE BOOSTS ---
    const boostsToCreate = [];
    const expirationDate = new Date(Date.now() + boostToBuy.duration * 24 * 60 * 60 * 1000);

    for (let i = 0; i < quantity; i++) {
        boostsToCreate.push({
            userId: user._id,
            boostId: boostToBuy.id,
            yieldIncreasePerHour: boostToBuy.yieldIncrease,
            expiresAt: expirationDate,
        });
    }

    const createdBoosts = await ActiveBoost.insertMany(boostsToCreate, { session });
    
    user.activeBoosts.push(...createdBoosts.map(b => b._id));
    user.boostYieldPerHour = (user.boostYieldPerHour || 0) + (boostToBuy.yieldIncrease * quantity);

    await user.save({ session });
}

module.exports = { grantBoostsToUser };