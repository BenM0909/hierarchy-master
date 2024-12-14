import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    console.log("API hit: /api/downloads");

    const { file } = req.query;
    const filePath = path.join('/tmp', file);

    if (!fs.existsSync(filePath)) {
        console.log("File not found:", filePath);
        res.status(404).json({ success: false, error: 'File not found' });
        return;
    }

    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(filePath).pipe(res);
}
