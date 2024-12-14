import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads.js");

    const { file } = req.query;
    const filePath = path.join('/tmp', file);

    console.log("File path being served:", filePath);

    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        res.status(404).send("File not found");
        return;
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${path.basename(file)}`);

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', err => {
        console.error("File streaming error:", err.message);
        res.status(500).send("Internal Server Error");
    });
}
