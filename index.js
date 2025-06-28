// --- START OF FILE atu-mining-api/index.js (CONFIRMADO) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const mainRoutes = require('./routes/index'); 
const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();
const corsOptions = { /* ... tu config de cors ... */ };
app.use(cors(corsOptions));
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL)
    .then(() => { /* ... */ })
    .catch(err => { /* ... */ });

// AÑADIMOS EL PREFIJO UNA SOLA VEZ, PARA TODAS LAS RUTAS
app.use('/api', mainRoutes);

app.get('/', (req, res) => res.send('API online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API en puerto ${PORT}`));
// --- END OF FILE atu-mining-api/index.js (CONFIRMADO) ---