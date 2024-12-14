const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { hierarchy } = req.body;
    if (!hierarchy) {
        return res.status(400).json({ error: 'No hierarchy provided' });
    }

    const basePath = path.join('/tmp', 'generatedFiles'); // Use /tmp for Vercel compatibility

    try {
        // Cleanup existing directory
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Process the hierarchy
        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];
            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                // Determine depth based on symbols
                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '');

                // Adjust stack based on depth
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    // Handle dot files and create file
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, '', 'utf8');
                } else {
                    // Create directory and push to stack
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Archive the files into a ZIP
        const zipPath = path.join('/tmp', 'generatedFiles.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // Include all files, including dot files
        const walkDir = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            entries.forEach((entry) => {
                const fullPath = path.join(dir, entry.name);
                const archivePath = path.relative(basePath, fullPath);
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else {
                    archive.file(fullPath, { name: archivePath });
                }
            });
        };

        walkDir(basePath);

        output.on('close', () => {
            const fileContents = fs.readFileSync(zipPath);

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="generatedFiles.zip"');
            res.setHeader('Content-Length', fileContents.length);

            res.status(200).send(fileContents);
        });

        archive.finalize();
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
}
