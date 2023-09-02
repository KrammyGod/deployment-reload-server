require('dotenv/config');
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = process.env.PORT || 5000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function handleRequest(req, res, chunks) {
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

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
        return res.writeHead(401).end('Unauthorized');
    }

    if (body.ref !== 'refs/heads/dist') {
        return res.writeHead(200).end('Acknowledged');
    }

    // We always assume that the repo is already cloned
    exec(`cd ../${body.repository.name} && git pull && npm ci --omit=dev && cd ${__dirname}`, (err) => {
        if (err) {
            console.error(err);
            return res.writeHead(500).end('Error happened. Probably wrong repository.');
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
