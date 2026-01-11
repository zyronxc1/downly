import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRateLimiter, analyzeRateLimiter, downloadRateLimiter, convertRateLimiter, queueStatusRateLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP detection (important for rate limiting)
app.set('trust proxy', 1);

// CORS Configuration
// Production: Restrict origins to specific domains (Netlify + custom domain)
// Development: Allow localhost for local development
const allowedOrigins: string[] = [];
if (process.env.NODE_ENV === 'development') {
  // Allow localhost in development
  allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
}
// Add production domains from environment variable (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()));
}

// CORS middleware with origin validation
app.use(cors({
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
    } else {
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    }
  },
  credentials: true, // Allow cookies/credentials if needed
  exposedHeaders: ['X-Download-Id', 'X-Job-Id', 'RateLimit-Remaining', 'RateLimit-Reset'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
}));

app.use(express.json());

// Apply general API rate limiting (with exclusions for SSE and queue endpoints)
// 🟢 PROPER RATE LIMITING: Skip /api/progress and /api/queue
app.use('/api', apiRateLimiter);

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// API Routes with specific rate limiters
import { analyzeHandler, batchAnalyzeHandler } from './routes/analyze';
import { downloadHandler } from './routes/download';
import { convertHandler } from './routes/convert';
import { progressHandler, progressStatusHandler, cancelDownloadHandler } from './routes/progress';
import { imageProxyHandler } from './routes/proxy';
import { 
  addDownloadJobHandler, 
  addConvertJobHandler, 
  getQueueHandler, 
  getJobHandler, 
  cancelJobHandler 
} from './routes/queue';

// API routes with specific rate limiters
app.post('/api/analyze', analyzeRateLimiter, analyzeHandler);
app.post('/api/analyze/batch', analyzeRateLimiter, batchAnalyzeHandler);
app.get('/api/download', downloadRateLimiter, downloadHandler);
app.post('/api/convert', convertRateLimiter, convertHandler);

// Progress tracking routes (no rate limiting for SSE, but status endpoint should be limited)
app.get('/api/progress/:downloadId', progressHandler);
app.get('/api/progress/:downloadId/status', progressStatusHandler);
app.post('/api/download/:downloadId/cancel', cancelDownloadHandler);

// Queue routes (excluded from general rate limiter, have their own limiters)
app.post('/api/queue/download', downloadRateLimiter, addDownloadJobHandler);
app.post('/api/queue/convert', convertRateLimiter, addConvertJobHandler);
app.get('/api/queue', queueStatusRateLimiter, getQueueHandler);
app.get('/api/queue/:jobId', queueStatusRateLimiter, getJobHandler);
app.post('/api/queue/:jobId/cancel', cancelJobHandler);

// Proxy routes (uses general rate limiter)
app.get('/api/proxy/image', imageProxyHandler);

// 404 handler - must be after all routes
app.use(notFound);

// Error handler - must be last
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
