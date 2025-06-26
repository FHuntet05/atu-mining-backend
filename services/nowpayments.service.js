// En: atu-mining-backend/services/nowpayments.service.js
const axios = require('axios');

const API_URL = 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NOWPAYMENTS_API_KEY;

const createPayment = async (priceAmount, orderId) => {
    if (!API_KEY) throw new Error("CRÍTICO: La clave API de NOWPayments no está configurada en el servidor.");

    try {
        const ipnCallbackUrl = `${process.env.BACKEND_URL}/api/webhooks/nowpayments`;
        
        const payload = {
            price_amount: priceAmount,
            price_currency: 'usd',
            pay_currency: 'usdtbep20',
            order_id: orderId,
            order_description: `Compra en ATU Mining`,
            ipn_callback_url: ipnCallbackUrl,
        };

        console.log("Enviando payload a NOWPayments:", payload); // Log para depuración

        const response = await axios.post(`${API_URL}/payment`, payload, {
            headers: { 'x-api-key': API_KEY }
        });

        console.log("Respuesta de NOWPayments recibida:", response.data); // Log de éxito
        return response.data;
    } catch (error) {
        console.error("Error al crear pago en NOWPayments:", error.response?.data || error.message);
        throw new Error("No se pudo generar la factura de pago desde el servicio.");
    }
};

module.exports = { createPayment };