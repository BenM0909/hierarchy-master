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
    const baseArchivePath = 'project-name'; // Root folder name in the ZIP

    try {
        // Clean up existing directory
        if (fs.existsSync(basePath)) {
            fs.rmSync(basePath, { recursive: true, force: true });
        }

        // Step 1: Parse the hierarchy and create the file system
        const processHierarchy = (lines, rootPath) => {
            const stack = [{ path: rootPath, depth: -1 }];

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                // Determine depth and type
                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;
                const isFile = !trimmedLine.endsWith('/');
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

                // Adjust the stack based on depth
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || rootPath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    // Create the file
                    console.log(`Creating file: ${fullPath}`);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(
                        fullPath,
                        relativePath.startsWith('.') ? `# Placeholder for ${relativePath}\n` : '',
                        'utf8'
                    );
                } else {
                    // Create the directory
                    console.log(`Creating directory: ${fullPath}`);
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Step 2: Debug - Verify file system contents
        const debugFileSystem = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const itemPath = path.join(dir, item.name);
                console.log(item.isFile() ? `Found file: ${itemPath}` : `Found directory: ${itemPath}`);
                if (item.isDirectory()) debugFileSystem(itemPath);
            });
        };

        console.log("File system contents before zipping:");
        debugFileSystem(basePath);

        // Step 3: Create the ZIP
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=generatedFiles.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error("Error creating ZIP archive:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        // Add files and directories to the archive
        const addFilesToArchive = (dir, baseInArchive) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach((item) => {
                const itemPath = path.join(dir, item.name);
                const archivePath = path.join(baseInArchive, item.name);

                if (item.isFile()) {
                    console.log(`Adding file to archive: ${archivePath}`);
                    archive.file(itemPath, { name: archivePath });
                } else if (item.isDirectory()) {
                    console.log(`Processing directory: ${itemPath}`);
                    addFilesToArchive(itemPath, archivePath); // Recursively add directories
                }
            });
        };

        addFilesToArchive(basePath, baseArchivePath);

        // Finalize the archive
        await archive.finalize();
        console.log("ZIP file streamed successfully.");
    } catch (err) {
        console.error("Error processing hierarchy:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
