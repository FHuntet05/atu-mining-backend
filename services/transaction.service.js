require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User'); // Asegúrate de que las rutas a los modelos sean correctas
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=txlist&address=${DEPOSIT_WALLET_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`;

let botInstance;

async function checkIncomingTransactions() {
  try {
    const pendingPayments = await Payment.find({ status: 'pending' });
    if (pendingPayments.length === 0) {
      return;
    }

    const response = await axios.get(BSCSCAN_API_URL);
    if (response.data.status !== '1') {
      // Si el mensaje es "No transactions found", no es un error, simplemente no hay nada que hacer.
      if (response.data.message !== 'No transactions found') {
        console.error('Error al obtener transacciones de BscScan:', response.data.message);
      }
      return;
    }
    const transactions = response.data.result;

    for (const payment of pendingPayments) {
      // --- INICIO DE MODIFICACIÓN: Añadir guarda de seguridad ---
      // Si el pago no tiene un monto único por alguna razón, lo ignoramos y registramos un aviso.
      if (typeof payment.uniqueAmount !== 'number') {
        console.warn(`Pago pendiente con ID ${payment._id} no tiene un 'uniqueAmount' válido. Saltando...`);
        continue; // Pasa al siguiente pago en el bucle
      }
      // --- FIN DE MODIFICACIÓN ---

      const matchedTx = transactions.find(tx => 
        tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() &&
        (Number(tx.value) / 1e18).toFixed(6) === payment.uniqueAmount.toFixed(6)
      );

      if (matchedTx) {
        const user = await User.findById(payment.userId).populate('referrerId');
        if (!user) {
          console.error(`Usuario no encontrado para el pago ${payment._id}`);
          payment.status = 'failed'; // Marcar como fallido para no reintentar
          await payment.save();
          continue;
        }

        payment.status = 'completed';
        payment.txHash = matchedTx.hash;
        await payment.save();

        user.usdtBalance = (user.usdtBalance || 0) + payment.baseAmount;

        await Transaction.create({
          userId: user._id,
          type: 'deposit',
          amount: payment.baseAmount,
          currency: 'USDT',
          status: 'completed',
          details: `Depósito confirmado vía BscScan. TxHash: ${matchedTx.hash}`
        });

        let missionReward = 0;
        if (!user.missions.firstBoostPurchased) {
            missionReward = 1000;
            user.autBalance = (user.autBalance || 0) + missionReward;
            user.missions.firstBoostPurchased = true;
        }
        
        // ... (Tu lógica de comisiones de referidos va aquí) ...

        await user.save();

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

function startCheckingTransactions(bot) {
  botInstance = bot;
  console.log('Iniciando el vigilante de transacciones de BscScan (cada 20 segundos)...');
  cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = {
  startCheckingTransactions,
};