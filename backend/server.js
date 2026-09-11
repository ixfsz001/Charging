const http = require('http');
const fs = require('fs');
const path = require('path');

// 备份文件根目录
const BACKUPS_ROOT = path.join(__dirname, 'backups');

// 确保存储根目录存在
if (!fs.existsSync(BACKUPS_ROOT)) {
    fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
}

// 获取用户备份目录
function getUserDir(userId) {
    const dir = path.join(BACKUPS_ROOT, userId || 'default');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

// 从请求中获取用户ID
function getUserId(req) {
    // 优先从 URL 参数获取，其次从 header 获取
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('uid') || req.headers['x-user-id'] || 'default';
}

const server = http.createServer((req, res) => {
    // 跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 接收备份数据
    if (req.method === 'POST' && req.url.startsWith('/api/backup')) {
        const userId = getUserId(req);
        const userDir = getUserDir(userId);

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `charging_backup_${timestamp}.json`;

                // 保存文件
                const filePath = path.join(userDir, fileName);
                fs.writeFileSync(filePath, data.content, 'utf8');

                // 自动清理，只保留最近 30 份
                const MAX_BACKUPS = 30;
                const files = fs.readdirSync(userDir)
                    .filter(f => f.startsWith('charging_backup_') && (f.endsWith('.txt') || f.endsWith('.json')))
                    .sort()
                    .reverse();
                if (files.length > MAX_BACKUPS) {
                    files.slice(MAX_BACKUPS).forEach(f => {
                        fs.unlinkSync(path.join(userDir, f));
                        console.log(`已清理旧备份: ${f}`);
                    });
                }

                // 生成下载链接
                const host = req.headers.host; // 例如 192.168.110.36:3000
                const downloadUrl = `http://${host}/api/download/${encodeURIComponent(fileName)}?uid=${encodeURIComponent(userId)}`;

                console.log(`备份成功: ${fileName}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    url: downloadUrl,
                    fileName: fileName
                }));
            } catch (e) {
                console.error('备份失败:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: e.message }));
            }
        });
        return;
    }

    // 下载文件
    if (req.method === 'GET' && req.url.startsWith('/api/download/')) {
        const userId = getUserId(req);
        const userDir = getUserDir(userId);
        const fileName = decodeURIComponent(req.url.split('/api/download/')[1].split('?')[0]);
        const filePath = path.join(userDir, fileName);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const isJson = fileName.endsWith('.json');
            res.writeHead(200, {
                'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`
            });
            res.end(content);
        } else {
            res.writeHead(404);
            res.end('文件不存在');
        }
        return;
    }

    // 获取备份文件内容（用于导入恢复）
    if (req.method === 'GET' && req.url.startsWith('/api/content/')) {
        const userId = getUserId(req);
        const userDir = getUserDir(userId);
        const fileName = decodeURIComponent(req.url.split('/api/content/')[1].split('?')[0]);
        const filePath = path.join(userDir, fileName);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, content: content }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: '文件不存在' }));
        }
        return;
    }

    // 列出所有备份
    if (req.method === 'GET' && req.url.startsWith('/api/backups')) {
        const userId = getUserId(req);
        const userDir = getUserDir(userId);
        const files = fs.readdirSync(userDir)
            .filter(f => f.startsWith('charging_backup_') && (f.endsWith('.txt') || f.endsWith('.json')))
            .sort()
            .reverse()
            .map(f => {
                const stat = fs.statSync(path.join(userDir, f));
                return {
                    name: f,
                    size: stat.size,
                    time: stat.mtime.toISOString()
                };
            });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files: files }));
        return;
    }

    // 删除备份
    if (req.method === 'DELETE' && req.url.startsWith('/api/backups/')) {
        const userId = getUserId(req);
        const userDir = getUserDir(userId);
        const fileName = decodeURIComponent(req.url.split('/api/backups/')[1].split('?')[0]);
        const filePath = path.join(userDir, fileName);

        if (fs.existsSync(filePath) && fileName.startsWith('charging_backup_')) {
            fs.unlinkSync(filePath);
            console.log(`已删除备份: ${fileName}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: '文件不存在' }));
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`备份服务器已启动`);
    console.log(`本机访问: http://127.0.0.1:${PORT}`);
    console.log(`等待备份请求...`);
});
