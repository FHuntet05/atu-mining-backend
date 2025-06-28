// --- START OF FILE atu-mining-api/index.js (VERSIÓN DEFINITIVA) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Importamos el enrutador principal
const mainRoutes = require('./routes/index'); // La ruta completa es más clara
const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

// --- MIDDLEWARE ---
const corsOptions = {
    origin: ['https://atu-mining-app-7ebs.onrender.com', 'https://web.telegram.org'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- CONEXIÓN A DB Y VIGILANTE ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions();
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));


// --- REGISTRO DE RUTAS (SIMPLIFICADO) ---
// Ahora Express usa las rutas tal y como están definidas en mainRoutes.
// La responsabilidad del prefijo '/api' la pasamos al siguiente archivo.
app.use('/', mainRoutes);


// --- Endpoint de salud ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando.');
});


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});
// --- END OF FILE atu-mining-api/index.js (VERSIÓN DEFINITIVA) ---