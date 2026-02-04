import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttpModule from 'pino-http';
const pinoHttp = pinoHttpModule.default || pinoHttpModule;
import type { Server } from 'http';

import logger from './utils/logger.js';
import { rateLimiter } from './middleware/rateLimit.js';
import errorHandler from './middleware/errorHandler.js';
import { authMiddleware, checkPaymentStatus } from './middleware/auth.js';
import { adminSupabase } from './utils/supabaseAdmin.js';

import feesRouter from './routes/fees-comprehensive.js';
import paymentsRouter from './routes/payments.js';
import marksRouter from './routes/marks.js';
import attendanceRouter from './routes/attendance.js';
import authRouter from './routes/auth.js';
import classesRouter from './routes/classes.js';
import classificationsRouter from './routes/classifications.js';
import subjectsRouter from './routes/subjects.js';
import studentsRouter from './routes/students.js';
import studentsAdminRouter from './routes/students-admin.js';
import staffAdminRouter from './routes/staff-admin.js';
import teacherAssignmentsRouter from './routes/teacher-assignments.js';
import teacherAttendanceRouter from './routes/teacher-attendance.js';
import teacherAttendanceAssignmentsRouter from './routes/teacher-attendance-assignments.js';
import schoolRouter from './routes/school.js';
import examsRouter from './routes/exams.js';
import dashboardRouter from './routes/dashboard.js';
import salaryRouter from './routes/salary.js';
import adminRouter from './routes/admin.js';
import principalUsersRouter from './routes/principal-users.js';
import clerkFeesRouter from './routes/clerk-fees.js';
import studentFeesRouter from './routes/studentFees.js';


// ======================================================
// ENV VALIDATION
// ======================================================

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length) {
  logger.error({ missingEnvVars }, 'Missing required environment variables');
  process.exit(1);
}


// ======================================================
// APP SETUP
// ======================================================

const app = express();

// CRITICAL: Trust proxy for correct IP detection behind Railway/AWS/Nginx
// This ensures rate limiting and logging work with real client IPs
app.set('trust proxy', 1);


// ======================================================
// SECURITY + PERFORMANCE MIDDLEWARE
// ======================================================
// Order is critical: helmet → cors → compression → rateLimit → json → logger → routes → errorHandler

// 1. Helmet - Security headers
app.use(helmet());

// 2. CORS - Cross-origin resource sharing
app.use(cors({
  origin: true,
  credentials: true
}));

// 3. Compression - Compress responses
app.use(compression());

// 4. Rate Limiting - Prevent abuse (300 req/min per IP - supports mobile apps + shared IPs)
app.use(rateLimiter);

// 5. JSON Parser - Parse request bodies
app.use(express.json({ limit: '1mb' }));

// 6. Request Logging - Log all requests with pino-http
app.use(pinoHttp({ logger }));


// ======================================================
// HEALTH CHECK
// ======================================================
// Must not require auth - placed before auth middleware

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// ======================================================
// READINESS ENDPOINT
// ======================================================
// Checks database connectivity - used by orchestration (Railway/AWS/K8s)
// Must not require auth - placed before auth middleware

app.get('/ready', async (_req, res) => {
  try {
    // Lightweight Supabase connectivity check
    const { error } = await adminSupabase
      .from('schools')
      .select('id')
      .limit(1);

    if (error) {
      logger.warn({ error }, 'Readiness check failed - database unreachable');
      return res.status(503).json({
        status: 'not_ready',
        error: 'database_unreachable',
        timestamp: Date.now(),
      });
    }

    // Database is reachable
    res.status(200).json({
      status: 'ready',
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    logger.error({ err }, 'Readiness check error');
    res.status(503).json({
      status: 'not_ready',
      error: 'database_unreachable',
      timestamp: Date.now(),
    });
  }
});


// ======================================================
// ROUTES
// ======================================================

// Public
app.use('/auth', authRouter);

// Auth middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  return authMiddleware(req, res, next);
});

// Admin (no payment check)
app.use('/admin', adminRouter);

// Payment check
app.use(checkPaymentStatus);

// Feature routes
app.use('/fees', feesRouter);
app.use('/payments', paymentsRouter);
app.use('/marks', marksRouter);
app.use('/attendance', attendanceRouter);
app.use('/classes', classesRouter);
app.use('/classifications', classificationsRouter);
app.use('/subjects', subjectsRouter);
app.use('/students', studentsRouter);
app.use('/students-admin', studentsAdminRouter);
app.use('/staff-admin', staffAdminRouter);
app.use('/teacher-assignments', teacherAssignmentsRouter);
app.use('/teacher-attendance', teacherAttendanceRouter);
app.use('/teacher-attendance-assignments', teacherAttendanceAssignmentsRouter);
app.use('/school', schoolRouter);
app.use('/exams', examsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/salary', salaryRouter);
app.use('/principal-users', principalUsersRouter);
app.use('/clerk-fees', clerkFeesRouter);
app.use('/students/fees', studentFeesRouter);


// ======================================================
// REQUEST TIMEOUT PROTECTION
// ======================================================
// Prevent hanging requests

app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout' });
    }
  });
  next();
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================
// Must be at the very end, after all routes

app.use(errorHandler);

// ======================================================
// CRASH PROTECTION
// ======================================================
// Handle unhandled promise rejections

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error(
    {
      err: reason,
      promise: promise.toString(),
    },
    'Unhandled Promise Rejection'
  );
  
  // Gracefully shutdown
  process.exit(1);
});

// Handle uncaught exceptions

process.on('uncaughtException', (err: Error) => {
  logger.error({ err }, 'Uncaught Exception');
  
  // Gracefully shutdown
  process.exit(1);
});

// ======================================================
// SERVER START
// ======================================================

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

const server: Server = app.listen(port, host, () => {
  logger.info({ port, host }, '🚀 Backend server started');
});

// Set server timeout
server.setTimeout(15000);

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================
// Handles SIGTERM (Railway/AWS/K8s) and SIGINT (Ctrl+C)
// Ensures zero-downtime restarts and clean shutdowns

const shutdown = (): void => {
  logger.info('Graceful shutdown started');

  server.close(() => {
    logger.info('All connections closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Force shutdown - graceful shutdown timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
