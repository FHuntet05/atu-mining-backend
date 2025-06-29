// atu-mining-api/services/notification.service.js
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => parseInt(id.trim()));

const notifyAdmins = (message) => {
    if (!TELEGRAM_BOT_TOKEN || ADMIN_IDS.length === 0) {
        console.warn("No se puede notificar a los admins: TELEGRAM_BOT_TOKEN o ADMIN_TELEGRAM_IDS no están configurados.");
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    ADMIN_IDS.forEach(chat_id => {
        axios.post(url, {
            chat_id,
            text: message,
            parse_mode: 'Markdown'
        }).catch(e => console.error(`Error notificando al admin ${chat_id}: ${e.message}`));
    });
};

const notifyUser = (telegramId, message) => {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    axios.post(url, {
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown'
    }).catch(e => console.error(`Error notificando al usuario ${telegramId}: ${e.message}`));
};

module.exports = { notifyAdmins, notifyUser };