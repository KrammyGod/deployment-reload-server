require('dotenv/config');
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = process.env.PORT || 5000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Attempts to convert given string to JSON, without throwing error.
 * @param {string} str 
 * @returns {Record<string, any>}
 */
function safeJSONParse(str) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return {};
    }
}

/**
 * Handles any incoming request to the server, and verifying signature
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }} res 
 * @param {Uint8Array[]} chunks 
 * @returns {void}
 */
function handleRequest(req, res, chunks) {
    const body = safeJSONParse(Buffer.concat(chunks).toString());

    function verify_signature() {
        const signature = crypto
            .createHmac('sha256', SECRET)
            .update(JSON.stringify(body))
            .digest('hex');
        const trusted = Buffer.from(`sha256=${signature}`, 'ascii');
        const untrusted = Buffer.from(req.headers['x-hub-signature-256'], 'ascii');
        return crypto.timingSafeEqual(trusted, untrusted);
    }

    let verified = false;
    try {
        verified = verify_signature();
    } catch (err) {}
    // Only check verified push events
    if (!verified || req.headers['x-github-event'] !== 'push') {
        res.writeHead(401).end('Unauthorized');
        return;
    }

    if (body.ref !== 'refs/heads/dist') {
        res.writeHead(200).end('Acknowledged');
        return;
    }

    // We always assume that the repo is already cloned
    // We stop the pm2 instance to reinstall new dependencies
    exec(`cd ../${body.repository.name} && pm2 stop *.config.js && git pull &&
        npm ci --omit=dev && pm2 start *.config.js && cd ${__dirname}`, (err) => {
        if (err) {
            console.error(err);
            res.writeHead(500).end('Error happened. Probably wrong repository.');
            return;
        }
        res.writeHead(200).end('Pulled and Deployed!');
    });
}

http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => {
        chunks.push(chunk);
    }).on('end', () => handleRequest(req, res, chunks));
}).listen(PORT, () => {
    console.log(`Github webhook server listening on port ${PORT}`);
});
