'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime');
const moment = require('moment');

const baseImage = fs.readFileSync(path.resolve(__dirname, 'base.jpg'));

const imageMap = new Map();

function tsImage() {
    let random;
    let randomHex;
    do {
        random = crypto.randomBytes(8);
        randomHex = random.toString('hex');
    } while (imageMap.has(randomHex));

    const res = Buffer.alloc(baseImage.byteLength + 8);
    baseImage.copy(res);
    random.copy(res, baseImage.byteLength);
    const now = moment().format("HH:mm:ss.SSS");
    imageMap.set(randomHex, {
        id: randomHex,
        seq: imageMap.size,
        time: now,
    });

    console.info(`Tracker image created: ${randomHex} at ${now}`);

    return res;
}

let serial;

function generateSerial() {
    serial = '' + Math.floor(Math.random() * 1e8);
    return serial;
}

generateSerial();

const ID_REGEX = /^\/id\/(\w+)$/;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/track.jpg') {
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': baseImage.byteLength + 8,
            'Cache-Control': 'private, no-transform, max-age=86400'
        }).end(tsImage());

    } else if (req.method === 'GET' && url.pathname === '/serial') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate'
        }).end(serial);

    } else if (req.method === 'POST' && url.pathname === '/serial') {
        generateSerial();
        res.writeHead(202, {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate'
        }).end();

    } else if (req.method === 'GET' && ID_REGEX.test(url.pathname)) {
        const match = url.pathname.match(ID_REGEX);
        const id = match[1];
        if (imageMap.has(id)) {
            const content = JSON.stringify(imageMap.get(id));
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                'Content-Length': Buffer.byteLength(content),
            }).end(content);
        } else {
            res.writeHead(404).end();
        }

    } else if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate'
        });
        fs.createReadStream(path.resolve(__dirname, 'public', 'index.html')).pipe(res);

    } else if (req.method === 'GET') {
        const file = path.resolve(__dirname, 'public', url.pathname.slice(1));
        try {
            const fileStream = fs.createReadStream(file);
            res.writeHead(200, {
                'Content-Type': mime.getType(file),
                'Cache-Control': 'private, no-cache, no-store, must-revalidate'
            });
            fileStream.pipe(res);
        } catch (e) {
            res.writeHead(404).end();
        }
    } else {
        res.writeHead(404).end();
    }
});

server.listen(3000);