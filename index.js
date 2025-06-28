// --- START OF FILE atu-mining-api/index.js (MODO SEGURO - DIAGNÓSTICO FINAL) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// --- 1. IMPORTAMOS SOLO LO ABSOLUTAMENTE ESENCIAL ---
const userRoutes = require('./routes/userRoutes');
const userController = require('./controllers/userController');

const app = express();

// --- 2. CONFIGURACIÓN DE CORS MÁS ABIERTA POSIBLE ---
// Esto permite peticiones desde CUALQUIER origen. Solo para depuración.
app.use(cors());
app.use(express.json());

// --- 3. CONEXIÓN A DB ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ [MODO SEGURO] Conectado a MongoDB.');
        // OJO: NO INICIAMOS EL VIGILANTE AÚN PARA AISLAR EL PROBLEMA
        // const { startCheckingTransactions } = require('./services/transaction.service');
        // startCheckingTransactions();
    })
    .catch(err => console.error('❌ [MODO SEGURO] Error de conexión a MongoDB:', err));

// --- 4. REGISTRO DE LA ÚNICA RUTA DE PRUEBA ---
// Solo vamos a registrar la ruta de sync para ver si funciona.
app.post('/api/users/sync', userController.syncUser);

// Dejamos una ruta de prueba adicional para verificar la conexión
app.get('/api/test', (req, res) => {
    res.status(200).send('¡La API en modo seguro está respondiendo!');
});

// --- 5. ENDPOINT DE SALUD Y LANZAMIENTO ---
app.get('/', (req, res) => {
    res.send('ATU Mining API (Modo Seguro) está en línea.');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ [MODO SEGURO] API Express escuchando en el puerto ${PORT}`);
});
// --- END OF FILE atu-mining-api/index.js (MODO SEGURO - DIAGNÓSTICO FINAL) ---