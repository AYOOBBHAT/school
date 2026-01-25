import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { authMiddleware, checkPaymentStatus } from './middleware/auth.js';

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
  console.error('❌ Missing required env vars:', missingEnvVars);
  process.exit(1);
}


// ======================================================
// APP SETUP
// ======================================================

const app = express();

app.set('trust proxy', 1); // important behind nginx / load balancer


// ======================================================
// SECURITY + PERFORMANCE MIDDLEWARE
// ======================================================

app.use(helmet());

app.use(cors({
  origin: true,
  credentials: true
}));

// compress responses (huge bandwidth win)
app.use(compression());

// safer JSON limits (prevent memory attacks)
app.use(express.json({ limit: '1mb' }));

// logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));


// ======================================================
// RATE LIMITING (VERY IMPORTANT FOR 50K USERS)
// ======================================================

const limiter = rateLimit({
  windowMs: 60 * 1000,     // 1 min
  max: 120,               // 120 req/min per IP
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/health', (_req, res) => res.json({ ok: true }));


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


// ======================================================
// SERVER START
// ======================================================

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`🚀 Backend running on http://${host}:${port}`);
});
