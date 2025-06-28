// --- START OF FILE atu-mining-backend/routes/leaderboardRoutes.js ---

const express = require('express');
const router = express.Router();
// Ya no necesitamos el modelo de User aquí, ya que los datos serán simulados.
// const User = require('../models/User');

// --- INICIO DE LA LÓGICA DE SIMULACIÓN ---

// 1. Un conjunto de perfiles de mineros falsos para darles variedad.
// Usamos pravatar.cc para obtener fotos de perfil únicas y aleatorias.
const fakeMinerProfiles = [
    { firstName: 'CryptoKing' },
    { firstName: 'Satoshi Jr.' },
    { firstName: 'QueenOfCoins' },
    { firstName: 'EtherWizard' },
    { firstName: 'LamboDreamer' },
    { firstName: 'The Miner' },
    { firstName: 'NodeRunner' },
    { firstName: 'DiamondHand' },
    { firstName: 'Captain HODL' },
    { firstName: 'ShibaInuMaxi' },
    { firstName: 'ChainSurfer' },
    { firstName: 'BlockWhisperer' },
    { firstName: 'YieldFarmer' },
    { firstName: 'MegaWhale' },
    { firstName: 'AltcoinHero' },
    { firstName: 'DeFi Master' },
    { firstName: 'GasFeeHater' },
    { firstName: 'DigitalNomad' },
    { firstName: 'TokenTrader' },
    { firstName: 'NFTCollector' }
];

// 2. La ruta GET del leaderboard ahora genera los datos en lugar de consultarlos.
// Ya no necesita ser 'async' porque no hay operaciones de base de datos.
router.get('/', (req, res) => {
    try {
        const simulatedLeaderboard = [];
        // Puntuación inicial muy alta para el primer lugar, para que parezca impresionante.
        let lastScore = 85_740_300; 
        const listSize = 20;

        for (let i = 0; i < listSize; i++) {
            const profile = fakeMinerProfiles[i];
            
            // Calculamos una puntuación para el minero actual.
            // Para todos excepto el primero, restamos una cantidad aleatoria de la puntuación anterior
            // para que la lista parezca natural y no lineal.
            if (i > 0) {
                // Resta entre el 3% y el 8% de la puntuación anterior.
                const decrementPercentage = (Math.random() * (0.08 - 0.03) + 0.03);
                lastScore -= lastScore * decrementPercentage;
            }

            // Añadimos el minero simulado a nuestra lista.
            simulatedLeaderboard.push({
                // Añadimos un _id falso. Es una buena práctica para que el frontend (React)
                // pueda usarlo como 'key' sin problemas.
                _id: `fake_miner_${i}`, 
                firstName: profile.firstName,
                // Generamos una URL de foto única para cada minero.
                photoUrl: `https://i.pravatar.cc/150?u=${profile.firstName}`,
                // La puntuación se redondea a un número entero.
                totalMinedAUT: Math.floor(lastScore) 
            });
        }

        res.status(200).json(simulatedLeaderboard);

    } catch (error) {
        // Aunque es muy poco probable que esta lógica falle, mantenemos el bloque catch por seguridad.
        console.error("Error al generar el leaderboard simulado:", error);
        res.status(500).json({ message: 'Error al cargar la tabla de líderes.' });
    }
});

// --- FIN DE LA LÓGICA DE SIMULACIÓN ---

module.exports = router;

// --- END OF FILE atu-mining-backend/routes/leaderboardRoutes.js ---