const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: false
    }
});

client.on('qr', qr => {
    console.log('QR RECEIVED');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.initialize().catch(err => console.error(err));
