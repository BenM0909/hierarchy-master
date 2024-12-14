import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads.js");

    const { file } = req.query; // Get the file name from the query parameters
    const filePath = path.join('/tmp', file); // Ensure it points to the /tmp directory

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.log("File not found:", filePath);
        res.status(404).json({ success: false, error: 'File not found' });
        return;
    }

    // Set correct headers for ZIP download
    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    res.setHeader('Content-Type', 'application/zip');

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
        console.error("Error streaming file:", err.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    });
}
