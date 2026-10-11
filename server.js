const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2'
};

// 压缩收益高的文本类型
const GZIP_TYPES = new Set(['.html', '.css', '.js', '.svg', '.json']);

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(__dirname, filePath);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        // ETag 协商缓存：内容未变返回 304
        const etag = '"' + crypto.createHash('md5').update(data).digest('hex').slice(0, 20) + '"';
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, { ETag: etag });
            res.end();
            return;
        }
        const headers = {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            ETag: etag
        };
        // 文本资源按协商压缩传输
        if (GZIP_TYPES.has(ext) && (req.headers['accept-encoding'] || '').includes('gzip')) {
            headers['Content-Encoding'] = 'gzip';
            res.writeHead(200, headers);
            res.end(zlib.gzipSync(data));
            return;
        }
        res.writeHead(200, headers);
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`画画乐园服务器已启动: http://localhost:${PORT}`);
    console.log(`iPad 请访问: http://<本机IP>:${PORT}`);
});
