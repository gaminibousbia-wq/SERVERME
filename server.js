require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const { Octokit } = require('@octokit/rest');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const API_KEY = process.env.API_KEY || 'default_key';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json());

// GitHub Setup
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');

// Auth Middleware
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

// Multer Storage Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Routes

// Upload File
app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;

    try {
        // Optional: Sync to GitHub if token is provided
        if (process.env.GITHUB_TOKEN && owner && repo) {
            const content = fs.readFileSync(filePath, { encoding: 'base64' });
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `${UPLOAD_DIR}/${fileName}`,
                message: `Upload file: ${fileName}`,
                content: content,
                branch: process.env.GITHUB_BRANCH || 'main'
            });
            console.log(`Successfully pushed ${fileName} to GitHub`);
        }

        res.json({
            message: 'File uploaded successfully',
            file: {
                name: fileName,
                path: `/uploads/${fileName}`,
                size: req.file.size,
                mimetype: req.file.mimetype
            },
            syncedToGithub: !!process.env.GITHUB_TOKEN
        });
    } catch (error) {
        console.error('GitHub Sync Error:', error);
        res.json({
            message: 'File saved locally but GitHub sync failed',
            error: error.message,
            file: { name: fileName }
        });
    }
});

// List Files
app.get('/api/files', authenticate, (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        const fileList = files.map(file => {
            const stats = fs.statSync(path.join(UPLOAD_DIR, file));
            return {
                name: file,
                size: stats.size,
                createdAt: stats.birthtime,
                url: `/uploads/${file}`
            };
        });
        res.json(fileList);
    });
});

// Search Files API
// Usage: GET /api/search?q=filename
app.get('/api/search', authenticate, (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan directory' });
        }

        const matches = files.filter(file => file.toLowerCase().includes(query.toLowerCase()));

        const results = matches.map(file => {
            const stats = fs.statSync(path.join(UPLOAD_DIR, file));
            return {
                name: file,
                matches: true,
                path: path.join(UPLOAD_DIR, file), // Physical path
                url: `/uploads/${file}`,           // Download URL
                size: stats.size
            };
        });

        res.json({
            query: query,
            found: results.length,
            results: results
        });
    });
});


// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

app.listen(PORT, () => {
    console.log(`
🚀 Server running at http://localhost:${PORT}
🔑 API Key is active
📁 Uploads directory: ${UPLOAD_DIR}
    `);
});
