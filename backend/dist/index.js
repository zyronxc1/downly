"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFound_1 = require("./middleware/notFound");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Trust proxy for accurate IP detection (important for rate limiting)
app.set('trust proxy', 1);
// CORS Configuration
// Production: Restrict origins to specific domains (Netlify + custom domain)
// Development: Allow localhost for local development
const allowedOrigins = [];
if (process.env.NODE_ENV === 'development') {
    // Allow localhost in development
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
}
// Add production domains from environment variable (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()));
}
// CORS middleware with origin validation
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, Postman)
        // In production, you may want to reject these
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (!origin) {
            return callback(new Error('CORS: Origin not allowed (no origin header)'));
        }
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: Origin ${origin} is not allowed`));
        }
    },
    credentials: true, // Allow cookies/credentials if needed
    exposedHeaders: ['X-Download-Id', 'X-Job-Id', 'RateLimit-Remaining', 'RateLimit-Reset'],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
}));
app.use(express_1.default.json());
// Apply general API rate limiting (with exclusions for SSE and queue endpoints)
// 🟢 PROPER RATE LIMITING: Skip /api/progress and /api/queue
app.use('/api', rateLimiter_1.apiRateLimiter);
// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// API Routes with specific rate limiters
const analyze_1 = require("./routes/analyze");
const download_1 = require("./routes/download");
const convert_1 = require("./routes/convert");
const progress_1 = require("./routes/progress");
const proxy_1 = require("./routes/proxy");
const queue_1 = require("./routes/queue");
// API routes with specific rate limiters
app.post('/api/analyze', rateLimiter_1.analyzeRateLimiter, analyze_1.analyzeHandler);
app.post('/api/analyze/batch', rateLimiter_1.analyzeRateLimiter, analyze_1.batchAnalyzeHandler);
app.get('/api/download', rateLimiter_1.downloadRateLimiter, download_1.downloadHandler);
app.post('/api/convert', rateLimiter_1.convertRateLimiter, convert_1.convertHandler);
// Progress tracking routes (no rate limiting for SSE, but status endpoint should be limited)
app.get('/api/progress/:downloadId', progress_1.progressHandler);
app.get('/api/progress/:downloadId/status', progress_1.progressStatusHandler);
app.post('/api/download/:downloadId/cancel', progress_1.cancelDownloadHandler);
// Queue routes (excluded from general rate limiter, have their own limiters)
app.post('/api/queue/download', rateLimiter_1.downloadRateLimiter, queue_1.addDownloadJobHandler);
app.post('/api/queue/convert', rateLimiter_1.convertRateLimiter, queue_1.addConvertJobHandler);
app.get('/api/queue', rateLimiter_1.queueStatusRateLimiter, queue_1.getQueueHandler);
app.get('/api/queue/:jobId', rateLimiter_1.queueStatusRateLimiter, queue_1.getJobHandler);
app.post('/api/queue/:jobId/cancel', queue_1.cancelJobHandler);
// Proxy routes (uses general rate limiter)
app.get('/api/proxy/image', proxy_1.imageProxyHandler);
// 404 handler - must be after all routes
app.use(notFound_1.notFound);
// Error handler - must be last
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
    else {
        console.error('Server error:', err);
        process.exit(1);
    }
});
//# sourceMappingURL=index.js.map