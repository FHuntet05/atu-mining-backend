// --- START OF FILE atu-mining-api/index.js (SOLUCIÓN DEFINITIVA A PRUEBA DE ERRORES) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Importamos el enrutador principal para el RESTO de las rutas
const mainRoutes = require('./routes/index'); 

// --- ¡IMPORTANTE! Importamos el userController directamente ---
const userController = require('./controllers/userController');

const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

// --- MIDDLEWARE ---
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin.endsWith('.onrender.com') || origin.startsWith('https://web.telegram.org')) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());


// --- CONEXIÓN A LA BASE DE DATOS ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions();
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));


// =================================================================
// =============== INICIO DE LA SOLUCIÓN DEFINITIVA =================
// =================================================================

// 1. DEFINIMOS LA RUTA PROBLEMÁTICA EXPLÍCITAMENTE EN LA APP.
//    Esto garantiza que exista antes que cualquier otra cosa.
app.post('/api/users/sync', userController.syncUser);

// 2. USAMOS EL ENRUTADOR PRINCIPAL PARA TODAS LAS DEMÁS RUTAS.
//    El archivo routes/index.js montará el resto (ej: /api/boosts, /api/tasks, etc.)
app.use('/', mainRoutes);

// =================================================================
// ================= FIN DE LA SOLUCIÓN DEFINITIVA ==================
// =================================================================


// --- Endpoint de salud ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando.');
});


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});

// --- END OF FILE atu-mining-api/index.js (SOLUCIÓN DEFINITIVA A PRUEBA DE ERRORES) ---