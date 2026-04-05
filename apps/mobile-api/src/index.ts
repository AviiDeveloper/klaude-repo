import express from 'express';
import cors from 'cors';
import { getDb } from './db.js';
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import visitRoutes from './routes/visits.js';
import photoRoutes from './routes/photos.js';
import syncRoutes from './routes/sync.js';
import pushRoutes from './routes/push.js';
import trainingRoutes from './routes/training.js';
// Payment routes exist but depend on packages/stripe/ and packages/supabase/ (not yet created).
// Uncomment when shared packages are available:
// import paymentRoutes from './routes/payments.js';

const PORT = Number(process.env.MOBILE_API_PORT ?? 4350);
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialise DB
getDb();

// Routes
app.use('/auth', authRoutes);
app.use('/leads', leadRoutes);
app.use('/visits', visitRoutes);
app.use('/photos', photoRoutes);
app.use('/sync', syncRoutes);
app.use('/push', pushRoutes);
app.use('/training', trainingRoutes);
// app.use('/payments', paymentRoutes); // Blocked: depends on packages/stripe/ (not yet created)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📱 SalesFlow Mobile API`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://0.0.0.0:${PORT}\n`);
});
