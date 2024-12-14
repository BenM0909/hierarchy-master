import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    const { hierarchy } = req.body;

    if (!hierarchy || typeof hierarchy !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid hierarchy format' });
        return;
    }

    const basePath = path.join('/tmp', 'generatedFiles');
    try {
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true });
        }

        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').length / 2;
                const isFile = !trimmed.endsWith('/');
                const relativePath = trimmed.replace(/^[│├└─ ]+/, '');

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, '');
                } else {
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        processHierarchy(hierarchy.split('\n'), basePath);

        const zipPath = path.join('/tmp', 'generatedFiles.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip');

        output.on('close', () => {
            res.json({ success: true, downloadUrl: `/api/downloads?file=generatedFiles.zip` });
        });

        archive.on('error', err => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(basePath, false);
        archive.finalize();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
