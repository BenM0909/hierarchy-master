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

    const basePath = path.join('/tmp', 'generatedFiles'); // Temporary directory for generated files
    const rootInArchive = 'project-name'; // Root folder name in the ZIP

    try {
        // Step 1: Clean up existing directory
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Step 2: Parse hierarchy and create files
        const processHierarchy = (lines, rootPath) => {
            const stack = [{ path: rootPath, depth: -1 }];

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

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

        // Debug: Verify all files, including dotfiles
        console.log("Debugging file system before archiving:");
        const debugFiles = (dir) => {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            files.forEach((file) => {
                console.log(`Found: ${file.isFile() ? 'File' : 'Directory'} - ${file.name}`);
                if (file.isDirectory()) {
                    debugFiles(path.join(dir, file.name));
                }
            });
        };
        debugFiles(path.join(basePath, rootInArchive));

        // Step 3: Create the ZIP
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=project.zip');

        const output = fs.createWriteStream('/tmp/project.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error("Archiving error:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(output);

        // Add files to archive explicitly, including dotfiles
        const addFilesToArchive = (dir, base) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const fullPath = path.join(dir, item.name);
                const relativePath = path.relative(base, fullPath);
                if (item.isDirectory()) {
                    addFilesToArchive(fullPath, base);
                } else {
                    console.log(`Adding file to archive: ${relativePath}`);
                    archive.file(fullPath, { name: relativePath });
                }
            });
        };

        addFilesToArchive(path.join(basePath, rootInArchive), path.join(basePath, rootInArchive));

        archive.finalize();

        output.on('close', () => {
            res.download('/tmp/project.zip');
        });

        console.log("ZIP file creation complete. Streaming to client.");
    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
