// En: atu-mining-backend/services/nowpayments.service.js
const axios = require('axios');

const API_URL = 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL;

const createPayment = async (priceAmount, orderId) => {
    // --- VALIDACIÓN DE VARIABLES DE ENTORNO ---
    if (!API_KEY) {
        console.error("Error Crítico: La variable de entorno NOWPAYMENTS_API_KEY no está definida.");
        throw new Error("Error de configuración del servidor [NPA-1].");
    }
    if (!BACKEND_URL) {
        console.error("Error Crítico: La variable de entorno BACKEND_URL no está definida.");
        throw new Error("Error de configuración del servidor [NPA-2].");
    }

    try {
        const ipnCallbackUrl = `${BACKEND_URL}/api/webhooks/nowpayments`;
        
        const payload = {
            price_amount: priceAmount,
            price_currency: 'usd',
            pay_currency: 'usdtbsc',
            order_id: orderId,
            order_description: `Compra en ATU Mining`,
            ipn_callback_url: ipnCallbackUrl,
            is_fee_paid_by_user: true // El usuario paga la fee de la transacción
        };

        console.log("Enviando payload a NOWPayments:", payload);

        const response = await axios.post(`${API_URL}/payment`, payload, {
            headers: { 'x-api-key': API_KEY }
        });

        console.log("Respuesta de NOWPayments recibida con éxito.");
        return response.data;
        
    } catch (error) {
        console.error("Error al llamar a la API de NOWPayments:", error.response?.data || error.message);
        // Devolvemos un error más genérico al frontend para no exponer detalles internos
        throw new Error("El servicio de pagos no está disponible en este momento.");
    }
};

module.exports = { createPayment };