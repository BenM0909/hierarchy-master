import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads.js");

    const { file } = req.query; // Extract file name from query parameters
    const filePath = path.join('/tmp', file); // Ensure it points to the `/tmp` directory

    console.log("File path being served:", filePath);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        res.status(404).json({ success: false, error: 'File not found' });
        return;
    }

    // Ensure `.gitignore` is in the ZIP by validating the directory contents
    const zipContents = fs.readdirSync(path.dirname(filePath));
    console.log("Contents of ZIP directory:", zipContents);

    if (!zipContents.includes('.gitignore')) {
        console.error("Error: `.gitignore` was not included in the ZIP file.");
        res.status(500).json({ success: false, error: '.gitignore missing in ZIP.' });
        return;
    }

    // Stream the file as a ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${path.basename(file)}`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => {
        console.error("Error streaming file:", err.message);
        res.status(500).json({ success: false, error: 'Error streaming file.' });
    });
}
