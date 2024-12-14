import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export default async function handler(req, res) {
    console.log("Request received at /api/create-files"); // Log request received

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    const { hierarchy } = req.body;

    // Validate input
    if (!hierarchy || typeof hierarchy !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid hierarchy format' });
        return;
    }

    const basePath = path.join('/tmp', 'generatedFiles'); // Use '/tmp' for serverless storage

    try {
        // Clean up existing directory
        if (fs.existsSync(basePath)) {
            console.log("Cleaning up existing directory...");
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Process the hierarchy
        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '');

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, '', 'utf8');
                } else {
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        console.log("Processing hierarchy...");
        processHierarchy(lines, basePath);

        // Create ZIP file
        const zipPath = path.join('/tmp', 'generatedFiles.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log("ZIP file created successfully:", zipPath);
            res.json({
                success: true,
                downloadUrl: `/api/downloads?file=generatedFiles.zip`,
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
        console.error("Error in /api/create-files:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
