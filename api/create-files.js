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
    const rootArchivePath = 'project-name';

    try {
        // Step 1: Clean up and prepare the file system
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Step 2: Parse and create files
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
                    fs.writeFileSync(fullPath, relativePath.startsWith('.') ? `# Placeholder for ${relativePath}` : '', 'utf8');
                } else {
                    console.log(`Creating directory: ${fullPath}`);
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Step 3: Validate `.gitignore` exists
        const gitignorePath = path.join(basePath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            console.log(".gitignore created successfully:", gitignorePath);
        } else {
            console.error("ERROR: .gitignore is missing in the file system.");
        }

        // Step 4: Create ZIP and validate contents
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=project.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error("Archiving error:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        const addFilesToArchive = (dir, baseInArchive) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const itemPath = path.join(dir, item.name);
                const archivePath = path.join(baseInArchive, item.name);

                if (item.isFile()) {
                    console.log(`Adding file to archive: ${archivePath}`);
                    archive.file(itemPath, { name: archivePath });
                } else if (item.isDirectory()) {
                    console.log(`Processing directory: ${archivePath}`);
                    addFilesToArchive(itemPath, archivePath);
                }
            });
        };

        addFilesToArchive(basePath, rootArchivePath);

        // Step 5: Finalize ZIP and stream
        await archive.finalize();
        console.log("ZIP file creation complete.");
    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
