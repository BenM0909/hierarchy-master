import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export default async function handler(req, res) {
    console.log("API hit: /api/create-files.js");

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
    const zipPath = path.join('/tmp', 'generatedFiles.zip');

    console.log("Base path:", basePath);
    console.log("ZIP path:", zipPath);

    try {
        // Cleanup old files and directories
        if (fs.existsSync(basePath)) fs.rmSync(basePath, { recursive: true });
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[│├└─ ]+/, '');

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();

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

        // Create the ZIP file
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`ZIP file created successfully. Size: ${archive.pointer()} bytes`);
            res.json({ success: true, downloadUrl: `/api/downloads.js?file=generatedFiles.zip` });
        });

        archive.on('error', err => {
            console.error("ZIP creation error:", err.message);
            throw err;
        });

        archive.pipe(output);
        archive.directory(basePath, false);
        await archive.finalize(); // Ensure the ZIP is finalized
    } catch (err) {
        console.error("Error in /api/create-files.js:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
