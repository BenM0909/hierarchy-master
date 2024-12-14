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

    const basePath = path.join('/tmp', 'generatedFiles'); // Temp directory for generated files
    const rootInArchive = 'project-name'; // Root folder name in the ZIP

    try {
        // Step 1: Clean up existing directory
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Step 2: Parse hierarchy and create files
        const tempDotfiles = []; // Track temp dotfiles for cleanup
        const processHierarchy = (lines, rootPath) => {
            const stack = [{ path: rootPath, depth: -1 }];

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                let relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

                // Temporarily rename dotfiles (e.g., `.gitignore` → `temp.gitignore`)
                if (relativePath.startsWith('.')) {
                    const tempName = `temp${relativePath}`;
                    tempDotfiles.push(path.join(rootPath, tempName));
                    relativePath = tempName;
                }

                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || rootPath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    console.log(`Creating file: ${fullPath}`);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, '', 'utf8');
                } else {
                    console.log(`Creating directory: ${fullPath}`);
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Step 3: Create the ZIP
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=project.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error("Archiving error:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        // Step 4: Add files to archive, restoring dotfile names
        const addFilesToArchive = (dir, baseInArchive) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                let itemPath = path.join(dir, item.name);
                let archivePath = path.join(baseInArchive, item.name);

                // Restore dotfile names in the ZIP
                if (item.name.startsWith('temp.')) {
                    const originalName = `.${item.name.slice(5)}`; // Strip 'temp.'
                    archivePath = path.join(baseInArchive, originalName);
                    console.log(`Restoring dotfile name for archive: ${archivePath}`);
                }

                if (item.isFile()) {
                    console.log(`Adding file to archive: ${archivePath}`);
                    archive.file(itemPath, { name: archivePath });
                } else if (item.isDirectory()) {
                    console.log(`Processing directory: ${archivePath}`);
                    addFilesToArchive(itemPath, archivePath); // Recursively add directories
                }
            });
        };

        addFilesToArchive(basePath, rootInArchive);

        // Step 5: Finalize and cleanup temporary dotfiles
        await archive.finalize();
        console.log("ZIP file creation complete. Streaming to client.");

        // Remove temporary dotfiles or rename them back
        tempDotfiles.forEach((tempFilePath) => {
            const originalPath = tempFilePath.replace('/temp.', '/.');
            console.log(`Restoring original dotfile name: ${originalPath}`);
            fs.renameSync(tempFilePath, originalPath);
        });
    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
