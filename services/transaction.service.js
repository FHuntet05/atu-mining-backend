require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=txlist&address=${DEPOSIT_WALLET_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`;

let botInstance; // Para mantener la instancia del bot y poder enviar notificaciones

// Función para verificar periódicamente las transacciones
async function checkIncomingTransactions() {
  try {
    // Buscar pagos pendientes en nuestra base de datos
    const pendingPayments = await Payment.find({ status: 'pending' });
    if (pendingPayments.length === 0) {
      // console.log('No hay pagos pendientes por verificar.');
      return;
    }

    // Obtener las últimas transacciones de la wallet desde BscScan
    const response = await axios.get(BSCSCAN_API_URL);
    if (response.data.status !== '1') {
      console.error('Error al obtener transacciones de BscScan:', response.data.message);
      return;
    }
    const transactions = response.data.result;

    // Procesar cada pago pendiente
    for (const payment of pendingPayments) {
      // Buscar una transacción en BscScan que coincida con el monto único
      const matchedTx = transactions.find(tx => 
        tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() &&
        (Number(tx.value) / 1e18).toFixed(6) === payment.uniqueAmount.toFixed(6)
      );

      if (matchedTx) {
        // --- TRANSACCIÓN ENCONTRADA Y CONFIRMADA ---
        const user = await User.findById(payment.userId).populate('referrerId');
        if (!user) {
          console.error(`Usuario no encontrado para el pago ${payment._id}`);
          continue;
        }

        // 1. Marcar el pago como completado
        payment.status = 'completed';
        payment.txHash = matchedTx.hash;
        await payment.save();

        // 2. Acreditar el saldo base (USDT) al usuario
        user.usdtBalance += payment.baseAmount;

        // 3. Crear un registro de la transacción
        await Transaction.create({
          userId: user._id,
          type: 'deposit',
          amount: payment.baseAmount,
          currency: 'USDT',
          status: 'completed',
          details: `Depósito confirmado vía BscScan. TxHash: ${matchedTx.hash}`
        });

        // --- INICIO DE MODIFICACIÓN: Lógica para Misión #2 - Comprar un Boost ---
        let missionReward = 0;
        if (!user.missions.firstBoostPurchased) {
            missionReward = 1000; // Recompensa por la primera compra
            user.autBalance = (user.autBalance || 0) + missionReward;
            user.missions.firstBoostPurchased = true;
        }
        // --- FIN DE MODIFICACIÓN ---

        // 4. Lógica de comisiones para referidos (si aplica)
        // ... (Tu lógica de comisiones multinivel existente va aquí) ...

        await user.save();

        // 5. Notificar al usuario sobre el éxito
        let successMessage = `✅ ¡Tu depósito de ${payment.baseAmount} USDT ha sido acreditado exitosamente!`;
        if (missionReward > 0) {
            successMessage += `\n\n🚀 ¡Felicidades por tu primera compra! Como recompensa, has recibido ${missionReward} AUT extra.`;
        }
        if (botInstance) {
          await botInstance.telegram.sendMessage(user.telegramId, successMessage)
            .catch(e => console.error(`No se pudo notificar al usuario ${user.telegramId} sobre el depósito:`, e));
        }
      }
    }
  } catch (error) {
    console.error('Error en checkIncomingTransactions:', error);
  }
}

// Función para iniciar el cron job
function startCheckingTransactions(bot) {
  botInstance = bot; // Guardar la instancia del bot
  console.log('Iniciando el vigilante de transacciones de BscScan (cada 20 segundos)...');
  cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = {
  startCheckingTransactions,
};