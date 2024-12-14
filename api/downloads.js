import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads.js");

    const { file } = req.query; // Extract file name from the query
    const filePath = path.join('/tmp', file); // Use the `/tmp` directory for generated files

    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        res.status(404).send("File not found");
        return;
    }

    // Set the correct headers for downloading
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=${path.basename(file)}`
    );

    // Stream the file to the response
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => {
        console.error("Error streaming file:", err.message);
        res.status(500).send("Internal server error");
    });
}
