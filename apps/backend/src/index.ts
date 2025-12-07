import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

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
import studentFeeOverridesRouter from './routes/student-fee-overrides.js';
import clerkFeesRouter from './routes/clerk-fees.js';

// Validate required environment variables at startup
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];


const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  // eslint-disable-next-line no-console
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    // eslint-disable-next-line no-console
    console.error(`   - ${varName}`);
  });
  // eslint-disable-next-line no-console
  console.error('\nPlease ensure all required variables are set in your .env file.');
  // eslint-disable-next-line no-console
  console.error('See .env.example for reference.\n');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public auth routes (no auth middleware)
app.use('/auth', authRouter);

// Protected routes (require auth middleware)
app.use(authMiddleware);

// Admin routes (no payment check needed)
app.use('/admin', adminRouter);

// All other protected routes (require payment check)
app.use(checkPaymentStatus);

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
app.use('/student-fee-overrides', studentFeeOverridesRouter);
app.use('/clerk-fees', clerkFeesRouter);

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Backend accessible on network at http://${host === '0.0.0.0' ? 'YOUR_LOCAL_IP' : host}:${port}`);
  // eslint-disable-next-line no-console
  console.log(`To find your local IP, run: hostname -I | awk '{print $1}'`);
});


