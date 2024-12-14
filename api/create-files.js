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

    try {
        // Stream the ZIP file directly to the client
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=generatedFiles.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error("Error creating ZIP archive:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[│├└─ ]+/, '');

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    archive.append('', { name: relativePath });
                } else {
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, '/');

        await archive.finalize();
        console.log("ZIP file streamed successfully.");
    } catch (err) {
        console.error("Error processing hierarchy:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
