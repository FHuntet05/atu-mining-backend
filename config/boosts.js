// En: atu-mining-backend/config/boosts.js
// ADAPTADO COMPLETAMENTE A LA ESTRUCTURA DEL FRONTEND

const boosts = [
  {
    id: 'boost_lvl_1', // Un ID único para la API
    level: 1,
    title: 'Paquete Básico AUT',
    price: 3, // Costo en USDT
    dailyYield: 15000,
    hardware: 'CPU Ryzen 3',
    duration: 30, // Duración en días
    // ---- Campos para la lógica del backend ----
    // Calculamos el aumento por hora para guardarlo en la DB
    yieldIncrease: 15000 / 24, //  AUT/hora
  },
  {
    id: 'boost_lvl_2',
    level: 2,
    title: 'Paquete GPU Pro',
    price: 6,
    dailyYield: 30000,
    hardware: 'CPU Ryzen 5',
    duration: 30,
    yieldIncrease: 30000 / 24, //  AUT/hora
  },
  {
    id: 'boost_lvl_3',
    level: 3,
    title: 'Pquete ASIC Ultra',
    price: 12,
    dailyYield: 75000,
    hardware: 'GPU RTX 3060',
    duration: 30,
    yieldIncrease: 75000 / 24, // AUT/hora
  },
   {
    id: 'boost_lvl_4',
    level: 4,
    title: 'Granja de Minado',
    price: 32,
    dailyYield: 160000,
    hardware: 'GPU RTX 3060',
    duration: 30,
    yieldIncrease: 160000 / 24, //  AUT/hora
  },
   {
    id: 'boost_lvl_5',
    level: 5,
    title: 'Centro de Datos',
    price: 76,
    dailyYield: 380000,
    hardware: 'GPU RTX 3060',
    duration: 30,
    yieldIncrease:  380000 / 24, //  AUT/hora
  },
  // Puedes seguir añadiendo boosts aquí con la misma estructura
];

module.exports = boosts;