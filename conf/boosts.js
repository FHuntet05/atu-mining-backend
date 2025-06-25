// En: atu-mining-backend/config/boosts.js

const boosts = [
  {
    id: 'boost_level_1',
    name: 'Minería Mejorada Nivel 1',
    cost: 10, // Costo en USDT
    yieldIncrease: 10, // Aumento de producción en AUT por hora
  },
  {
    id: 'boost_level_2',
    name: 'Minería Mejorada Nivel 2',
    cost: 45,
    yieldIncrease: 50,
  },
  {
    id: 'boost_level_3',
    name: 'Minería Avanzada Nivel 1',
    cost: 100,
    yieldIncrease: 120,
  },
  // Puedes añadir más boosts aquí en el futuro.
  // El frontend leerá esta misma lista desde un endpoint que podemos crear después.
];

module.exports = boosts;