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

    try {
        // Clean up existing directory
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
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

                // Adjust stack based on depth
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    console.log(`Creating file: ${fullPath}`);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

                    // Explicitly handle .gitignore and other dotfiles
                    if (relativePath === '.gitignore') {
                        fs.writeFileSync(fullPath, '# This is a .gitignore file\n', 'utf8');
                    } else {
                        fs.writeFileSync(fullPath, '', 'utf8');
                    }
                } else {
                    console.log(`Creating directory: ${fullPath}`);
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        // Split the hierarchy into lines and process it
        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Create ZIP file and stream it
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=generatedFiles.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            console.error("Error creating ZIP archive:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        // Add the entire directory
        archive.directory(basePath, false);

        // Manually include .gitignore to ensure it's in the ZIP
        const gitignorePath = path.join(basePath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            console.log("Explicitly adding .gitignore to the archive");
            archive.file(gitignorePath, { name: 'project-name/.gitignore' });
        } else {
            console.error(".gitignore was not found in the directory structure.");
        }

        // Finalize the archive
        await archive.finalize();
        console.log("ZIP file streamed successfully.");
    } catch (err) {
        console.error("Error processing hierarchy:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
