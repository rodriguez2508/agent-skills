import express, { Application } from 'express';

export const app: Application = express();
const port = 8004;

app.use(express.json());
app.use((req, res, next) => {
  // Middleware inline logic for extracting client IP
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;

  let ipAddress: string;

  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ipAddress = realIp;
  } else {
    ipAddress = req.socket.remoteAddress || '127.0.0.1';
  }

  if (ipAddress.startsWith('::ffff:')) {
    ipAddress = ipAddress.substring(7);
  }

  (req as any).ipAddress = ipAddress;
  (req as any).userId = ipAddress;

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`MCP HTTP server running at http://localhost:${port}`);
});
