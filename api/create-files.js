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

    const basePath = path.join('/tmp', 'generatedFiles'); // Temp directory to store files
    const rootInArchive = 'project-name'; // Top-level folder in ZIP

    try {
        // 1. Clean up existing directory
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // 2. Create files and directories based on hierarchy
        const processHierarchy = (lines, baseDir) => {
            const stack = [{ path: baseDir, depth: -1 }];

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || baseDir;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    console.log(`Creating file: ${fullPath}`);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, relativePath.startsWith('.') ? `# ${relativePath}\n` : '', 'utf8');
                } else {
                    console.log(`Creating directory: ${fullPath}`);
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Debug: Check the created directory structure
        const listFiles = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const itemPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    console.log(`Directory: ${itemPath}`);
                    listFiles(itemPath);
                } else {
                    console.log(`File: ${itemPath}`);
                }
            });
        };

        console.log("File system before zipping:");
        listFiles(basePath);

        // 3. Create the ZIP file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=project.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error("Archiving error:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        // Add all files and directories manually to ensure everything is included
        const addToArchive = (dir, baseInArchive) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const itemPath = path.join(dir, item.name);
                const archivePath = path.join(baseInArchive, item.name);

                if (item.isFile()) {
                    console.log(`Adding file to archive: ${archivePath}`);
                    archive.file(itemPath, { name: archivePath });
                } else if (item.isDirectory()) {
                    console.log(`Processing directory: ${archivePath}`);
                    addToArchive(itemPath, archivePath);
                }
            });
        };

        addToArchive(basePath, rootInArchive);

        // Finalize the ZIP file
        await archive.finalize();
        console.log("ZIP file creation complete.");
    } catch (err) {
        console.error("Error processing hierarchy:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
