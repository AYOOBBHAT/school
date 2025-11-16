import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authMiddleware } from './middleware/auth';
import feesRouter from './routes/fees-comprehensive';
import paymentsRouter from './routes/payments';
import marksRouter from './routes/marks';
import attendanceRouter from './routes/attendance';
import authRouter from './routes/auth';
import approvalsRouter from './routes/approvals';
import classesRouter from './routes/classes';
import classificationsRouter from './routes/classifications';
import subjectsRouter from './routes/subjects';
import studentsRouter from './routes/students';
import studentsAdminRouter from './routes/students-admin';
import staffAdminRouter from './routes/staff-admin';
import teacherAssignmentsRouter from './routes/teacher-assignments';
import teacherAttendanceRouter from './routes/teacher-attendance';
import schoolRouter from './routes/school';
import examsRouter from './routes/exams';
import dashboardRouter from './routes/dashboard';
import salaryRouter from './routes/salary';

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

app.use('/fees', feesRouter);
app.use('/payments', paymentsRouter);
app.use('/marks', marksRouter);
app.use('/attendance', attendanceRouter);
app.use('/approvals', approvalsRouter);
app.use('/classes', classesRouter);
app.use('/classifications', classificationsRouter);
app.use('/subjects', subjectsRouter);
app.use('/students', studentsRouter);
app.use('/students-admin', studentsAdminRouter);
app.use('/staff-admin', staffAdminRouter);
app.use('/teacher-assignments', teacherAssignmentsRouter);
app.use('/teacher-attendance', teacherAttendanceRouter);
app.use('/school', schoolRouter);
app.use('/exams', examsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/salary', salaryRouter);

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


