const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Serve the front-end HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the generated ZIP files
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Handle file creation requests
app.post('/create-files', (req, res) => {
    const { hierarchy } = req.body;
    const basePath = path.join(__dirname, 'generatedFiles');

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
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '');

                // Adjust stack based on depth
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = path.join(parentPath, relativePath);

                if (isFile) {
                    // Create the file
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, '', 'utf8');
                } else {
                    // Create the directory and push it onto the stack
                    fs.mkdirSync(fullPath, { recursive: true });
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        // Split the hierarchy into lines and process it
        const lines = hierarchy.split('\n');
        processHierarchy(lines, basePath);

        // Create ZIP file
        const zipPath = path.join(__dirname, 'downloads', 'generatedFiles.zip');
        if (!fs.existsSync(path.dirname(zipPath))) {
            fs.mkdirSync(path.dirname(zipPath), { recursive: true });
        }

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.json({
                success: true,
                downloadUrl: `http://localhost:${PORT}/downloads/generatedFiles.zip`,
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(basePath, false);
        archive.finalize();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
