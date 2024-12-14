import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads.js");

    // Get the file name from query parameters
    const { file } = req.query;
    const filePath = path.join('/tmp', file); // Temporary directory for generated files

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.log("File not found:", filePath);
        res.status(404).send("File not found");
        return;
    }

    // Set headers to prompt file download
    res.setHeader('Content-Type', 'application/zip'); // Indicate ZIP file type
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=${path.basename(file)}` // Downloadable attachment with correct filename
    );

    // Stream the file directly to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
        console.error("Error streaming file:", err.message);
        res.status(500).send("Internal Server Error");
    });
}
