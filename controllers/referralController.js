const mongoose = require('mongoose');
const User = require('../models/User');

const COMMISSIONS = { level1: 0.30, level2: 0.15, level3: 0.075 };

exports.getReferralData = async (req, res) => {
    try {
        const { telegramId } = req.params;

        // Convertir el telegramId a ObjectId del usuario principal
        const mainUser = await User.findOne({ telegramId: parseInt(telegramId, 10) }, '_id');
        if (!mainUser) {
            return res.status(404).json({ message: 'Usuario principal no encontrado.' });
        }
        const userId = mainUser._id;

        // --- CONSULTA DE AGREGACIÓN OPTIMIZADA ---
        // Esta es la forma más eficiente de obtener los datos de los 3 niveles.
        const results = await User.aggregate([
            // 1. Encontrar el usuario principal
            { $match: { _id: userId } },
            
            // 2. Obtener referidos de Nivel 1
            {
                $lookup: {
                    from: 'users',
                    localField: 'referrals',
                    foreignField: '_id',
                    as: 'level1Refs',
                    // Poblamos el Nivel 2 dentro del Nivel 1
                    pipeline: [{
                        $lookup: {
                            from: 'users',
                            localField: 'referrals',
                            foreignField: '_id',
                            as: 'level2Refs',
                            // Poblamos el Nivel 3 dentro del Nivel 2
                            pipeline: [{
                                $lookup: {
                                    from: 'users',
                                    localField: 'referrals',
                                    foreignField: '_id',
                                    as: 'level3Refs'
                                }
                            }]
                        }
                    }]
                }
            },
            
            // 3. Proyectar y calcular los conteos
            {
                $project: {
                    _id: 0,
                    telegramId: '$telegramId',
                    totalEarnings: { $ifNull: ['$referralEarnings', 0] },
                    level1Count: { $size: '$level1Refs' },
                    // Sumamos el conteo de referidos de todos los usuarios de Nivel 1
                    level2Count: { $sum: '$level1Refs.level2Refs.level3Refs.level2Refs' }, // Esto es complejo, simplificamos abajo
                    // Para simplificar, calcularemos L2 y L3 fuera de la agregación por ahora
                    level1Data: '$level1Refs'
                }
            }
        ]);
        
        if (results.length === 0) {
            return res.status(404).json({ message: 'No se encontraron datos de referidos.' });
        }

        const data = results[0];
        
        // Cálculo de Nivel 2 y 3 fuera de la agregación para mayor claridad
        const level1Users = data.level1Data || [];
        const level2Users = level1Users.flatMap(l1 => l1.level2Refs || []);
        const level3Users = level2Users.flatMap(l2 => l2.level3Refs || []);

        const referralData = {
            code: data.telegramId,
            totalEarnings: data.totalEarnings,
            tiers: [
              { level: 1, title: 'Afiliados Directos', invites: level1Users.length, earnings: (data.totalEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: COMMISSIONS.level1 },
              { level: 2, title: 'Nivel 2', invites: level2Users.length, earnings: '0.00', color: '#f7a84e', gainPerReferral: COMMISSIONS.level2 },
              { level: 3, title: 'Nivel 3', invites: level3Users.length, earnings: '0.00', color: '#d84ef7', gainPerReferral: COMMISSIONS.level3 },
            ]
        };

        res.status(200).json(referralData);

    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
};