// --- START OF FILE atu-mining-api/index.js (CORREGIDO) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Importamos el enrutador principal que contiene todas nuestras rutas
const mainRoutes = require('./routes'); 
// Importamos el vigilante
const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

// --- MIDDLEWARE ESENCIAL ---

// 1. Configuración de CORS para permitir peticiones desde tu frontend
// (Asegúrate de cambiar la URL por la de tu frontend real)
const corsOptions = {
    // Aquí deben ir las URLs de confianza. La de tu app y la de Telegram para pruebas.
    origin: ['https://atu-mining-app-7e6s.onrender.com', 'https://web.telegram.org'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 2. Middleware para parsear JSON en las peticiones
app.use(express.json());

// --- CONEXIÓN A LA BASE DE DATOS ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        // Iniciamos el vigilante SOLO si la conexión a la DB es exitosa
        startCheckingTransactions(); 
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));


// --- REGISTRO DE RUTAS (LA CORRECCIÓN CLAVE) ---
// Aquí le decimos a Express que TODAS las rutas definidas en 'mainRoutes'
// estarán bajo el prefijo '/api'.
// Esto asegura que una petición a '/api/users/sync' funcione.
app.use('/api', mainRoutes);


// --- Endpoint de salud para Render ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando.');
});


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});

// --- END OF FILE atu-mining-api/index.js (CORREGIDO) ---