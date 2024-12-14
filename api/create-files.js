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
        // Set headers for the response
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=generatedFiles.zip');

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error("Error creating ZIP archive:", err);
            res.status(500).send("Internal Server Error");
        });

        archive.pipe(res);

        // Process the hierarchy
        const processHierarchy = (lines, basePath) => {
            const stack = [{ path: basePath, depth: -1 }];

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;

                // Determine depth based on symbols
                const depth = (line.match(/^[│├└─ ]+/)?.[0] || '').replace(/[├└─│]/g, '').length / 2;

                // Identify if it's a file or directory
                // A file is any line that does NOT end with `/` OR starts with `.`
                const isFile = !trimmedLine.endsWith('/') || /^\..+/.test(trimmedLine);

                // Clean up the relative path (remove `├─`, `└─`, etc.)
                const relativePath = trimmedLine.replace(/^[├└─│ ]+/, '').trim();

                // Adjust stack based on depth
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                const parentPath = stack[stack.length - 1]?.path || basePath;
                const fullPath = `${parentPath}/${relativePath}`;

                if (isFile) {
                    // Add a file to the archive, including dotfiles
                    console.log(`Adding file to archive: ${fullPath}`);
                    // Ensure content for `.gitignore` or empty files
                    archive.append(relativePath.startsWith('.') ? '# Dotfile\n' : '', {
                        name: fullPath,
                    });
                } else {
                    // Add a directory to the archive
                    console.log(`Adding directory to archive: ${fullPath}`);
                    stack.push({ path: fullPath, depth });
                }
            });
        };

        // Split the hierarchy into lines and process it
        const lines = hierarchy.split('\n');
        processHierarchy(lines, '');

        // Finalize the archive
        await archive.finalize();
        console.log("ZIP file streamed successfully.");
    } catch (err) {
        console.error("Error processing hierarchy:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}
