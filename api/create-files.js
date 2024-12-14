import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export default async function handler(req, res) {
    console.log("API hit: /api/create-files.js"); // Log with .js for debugging

    if (req.method !== 'POST') {
        console.log("Invalid method:", req.method);
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    const { hierarchy } = req.body;

    if (!hierarchy || typeof hierarchy !== 'string') {
        console.log("Invalid hierarchy format");
        res.status(400).json({ success: false, error: 'Invalid hierarchy format' });
        return;
    }

    const basePath = path.join('/tmp', 'generatedFiles');
    console.log("Base path created:", basePath);

    try {
        if (fs.existsSync(basePath)) {
            console.log("Cleaning up existing directory...");
            fs.rmSync(basePath, { recursive: true });
        }

        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[│├└─ ]+/, '');

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

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        const zipPath = path.join('/tmp', 'generatedFiles.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log("ZIP file created successfully");
            res.json({
                success: true,
                downloadUrl: `/api/downloads.js?file=generatedFiles.zip`,
            });
        });

        archive.on('error', (err) => {
            console.error("Error during ZIP creation:", err.message);
            throw err;
        });

        archive.pipe(output);
        archive.directory(basePath, false);
        archive.finalize();
    } catch (err) {
        console.error("Error in /api/create-files.js:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
