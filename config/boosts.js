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
    duration: 7, // Duración en días
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
    duration: 10,
    yieldIncrease: 30000 / 24, //  AUT/hora
  },
  {
    id: 'boost_lvl_3',
    level: 3,
    title: 'Pquete ASIC Ultra',
    price: 12,
    dailyYield: 50000,
    hardware: 'GPU RTX 3060',
    duration: 13,
    yieldIncrease: 50000 / 24, // AUT/hora
  },
   {
    id: 'boost_lvl_4',
    level: 4,
    title: 'Granja de Minado',
    price: 32,
    dailyYield: 70000,
    hardware: 'GPU RTX 3060',
    duration: 17,
    yieldIncrease: 70000 / 24, //  AUT/hora
  },
   {
    id: 'boost_lvl_5',
    level: 5,
    title: 'Centro de Datos',
    price: 76,
    dailyYield: 300000,
    hardware: 'GPU RTX 3060',
    duration: 22,
    yieldIncrease:  300000 / 24, //  AUT/hora
  },
  // Puedes seguir añadiendo boosts aquí con la misma estructura
];

module.exports = boosts;