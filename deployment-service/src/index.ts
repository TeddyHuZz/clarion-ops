import express from 'express';
import type { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const port = process.env['PORT'] || 8003;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Body Parsing
app.use(express.json());

// Routes
import { handleGithubWebhook } from './controllers/webhookController.js';
app.post('/webhooks/github', handleGithubWebhook);

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    service: 'deployment-service',
    timestamp: new Date().toISOString()
  });
});

// Root Route
app.get('/', (_req: Request, res: Response) => {
  res.send('Clarion Ops Deployment Service - Monitoring Pipelines');
});

// Start Server
app.listen(port, () => {
  console.log(`[server]: Deployment Service is running at http://localhost:${port}`);
});

export default app;
