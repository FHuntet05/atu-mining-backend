// En atu-mining-backend/helpers/crypto.helper.js
const CryptoJS = require('crypto-js');
const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
if (!SECRET_KEY) throw new Error("¡ENCRYPTION_SECRET_KEY no está definida!");

const encrypt = (text) => CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
const decrypt = (ciphertext) => CryptoJS.AES.decrypt(ciphertext, SECRET_KEY).toString(CryptoJS.enc.Utf8);

module.exports = { encrypt, decrypt };