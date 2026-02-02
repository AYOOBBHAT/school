# 🏫 JhelumVerse - School Management System

A comprehensive, multi-tenant SaaS platform for managing all aspects of school operations. Built with modern technologies and designed for scalability, security, and ease of use.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Development](#development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## 🎯 Overview

JhelumVerse is a complete school management system that enables schools to manage:
- **Student Management**: Admissions, enrollment, profiles, and academic records
- **Staff Management**: Teachers, clerks, and administrative staff
- **Fee Management**: Fee structures, collection, payment tracking, and receipts
- **Attendance Tracking**: Student and staff attendance with automated reports
- **Examination System**: Marks entry, result generation, and report cards
- **Salary Management**: Teacher salary structures, payments, and credit system
- **Class Management**: Classes, sections, subjects, and assignments
- **Multi-Tenant Architecture**: Complete data isolation per school

### Key Highlights

- ✅ **Multi-Tenant SaaS**: Each school operates independently with complete data isolation
- ✅ **Role-Based Access**: 5 distinct user roles (Principal, Clerk, Teacher, Student, Parent)
- ✅ **Modern Stack**: TypeScript, React, Express, Supabase, and more
- ✅ **Production-Ready**: Built with security, performance, and scalability in mind
- ✅ **Multi-Platform**: Web application, mobile app, and RESTful API
- ✅ **Row-Level Security**: Database-level security with Supabase RLS policies

## ✨ Features

### User Roles & Permissions

1. **Principal** - Full administrative access
   - School configuration and management
   - Staff approval and management
   - Fee structure management
   - Reports and analytics

2. **Clerk** - Administrative tasks
   - Fee collection and payment processing
   - Student record management
   - Payment history and receipts

3. **Teacher** - Academic management
   - Attendance marking
   - Marks entry and grading
   - Class and subject management

4. **Student** - Self-service portal
   - View attendance records
   - Check marks and results
   - View fee status and payment history

5. **Parent** - Child progress tracking
   - View child's attendance
   - Check academic performance
   - Monitor fee payments

### Core Modules

- **Student Management**: Complete student lifecycle management
- **Fee Management**: Comprehensive fee collection system with payment tracking
- **Attendance System**: Automated attendance tracking with reports
- **Examination System**: Marks entry, result calculation, and report cards
- **Salary Management**: Teacher salary structures, payments, and credit system
- **Class Management**: Classes, sections, subjects, and academic structure
- **Dashboard & Analytics**: Real-time statistics and insights

For a complete feature list, see [FEATURES.md](./FEATURES.md).

## 🛠 Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Recharts** - Data visualization

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Supabase** - Database and authentication
- **Upstash Redis** - Caching layer
- **Joi** - Input validation
- **Pino** - Logging

### Database
- **PostgreSQL** (via Supabase) - Primary database
- **Row-Level Security (RLS)** - Multi-tenant data isolation
- **Database Functions** - Server-side logic
- **Migrations** - Version-controlled schema

### Mobile
- **React Native** - Cross-platform mobile framework
- **React Navigation** - Navigation library
- **AsyncStorage** - Local storage

### DevOps & Tools
- **Turbo** - Monorepo build system
- **pnpm** - Package manager
- **Husky** - Git hooks
- **ESLint** - Code linting

## 🏗 Architecture

### Monorepo Structure

The project uses a **Turborepo monorepo** structure with:

```
school/
├── apps/
│   ├── backend/      # Express.js API server (Node.js/TypeScript)
│   ├── web/          # React web application (Vite/TypeScript)
│   └── mobile/       # React Native mobile app (Expo/TypeScript)
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared UI components
│   ├── utils/        # Shared utilities
│   └── config/       # Shared configuration (ESLint, Tailwind, TS)
└── supabase/
    └── migrations/   # Database migrations (PostgreSQL)
```

### Multi-Tenant Architecture

- **School Isolation**: Each school has a unique `school_id`
- **Row-Level Security**: Database-level filtering by `school_id`
- **User Context**: JWT tokens include school and role information
- **API Security**: Backend validates school_id on all requests

### Data Flow

1. **Authentication**: Users authenticate via Supabase Auth
2. **Authorization**: JWT tokens contain user role and school_id
3. **API Requests**: Backend validates permissions and filters data
4. **Database Queries**: RLS policies enforce school-level isolation
5. **Response**: Filtered data returned to client

## 📁 Project Structure

```
school/
├── apps/
│   ├── backend/                    # Backend API server (Express.js)
│   │   ├── src/
│   │   │   ├── routes/            # API route handlers
│   │   │   │   ├── admin.ts      # Admin routes
│   │   │   │   ├── attendance.ts # Attendance management
│   │   │   │   ├── auth.ts       # Authentication
│   │   │   │   ├── classes.ts    # Class management
│   │   │   │   ├── clerk-fees.ts # Clerk fee collection
│   │   │   │   ├── dashboard.ts  # Dashboard stats
│   │   │   │   ├── exams.ts      # Examination system
│   │   │   │   ├── fees.ts       # Fee management
│   │   │   │   ├── salary.ts     # Salary management
│   │   │   │   ├── students.ts   # Student management
│   │   │   │   └── ...           # Other route files
│   │   │   ├── middleware/       # Express middleware
│   │   │   │   ├── auth.ts       # Authentication middleware
│   │   │   │   ├── errorHandler.ts # Error handling
│   │   │   │   └── rateLimit.ts  # Rate limiting
│   │   │   ├── utils/            # Utility functions
│   │   │   │   ├── cache.ts      # Redis caching
│   │   │   │   ├── logger.ts     # Logging utilities
│   │   │   │   └── ...           # Other utilities
│   │   │   ├── jobs/             # Background jobs/cron
│   │   │   └── index.ts          # Server entry point
│   │   ├── dist/                 # Compiled JavaScript
│   │   ├── scripts/              # Build/deployment scripts
│   │   ├── docs/                 # Backend documentation
│   │   └── package.json
│   │
│   ├── web/                       # React web application
│   │   ├── src/
│   │   │   ├── pages/            # Page components
│   │   │   │   ├── Login.tsx     # Login page
│   │   │   │   ├── Signup.tsx    # Signup page
│   │   │   │   ├── principal/    # Principal dashboard pages
│   │   │   │   ├── clerk/       # Clerk dashboard pages
│   │   │   │   ├── teacher/     # Teacher dashboard pages
│   │   │   │   ├── student/     # Student dashboard pages
│   │   │   │   └── ...          # Other pages
│   │   │   ├── components/       # Reusable components
│   │   │   │   ├── FeeCollection.tsx
│   │   │   │   ├── FeeDetailsDrawer.tsx
│   │   │   │   └── ...          # Other components
│   │   │   ├── services/         # API service layer
│   │   │   ├── utils/            # Utility functions
│   │   │   ├── App.tsx           # Main app component
│   │   │   ├── main.tsx          # Entry point
│   │   │   └── styles.css        # Global styles
│   │   ├── public/               # Static assets
│   │   ├── dist/                 # Production build
│   │   ├── vite.config.ts        # Vite configuration
│   │   ├── tailwind.config.cjs   # Tailwind CSS config
│   │   └── package.json
│   │
│   └── mobile/                    # React Native mobile app
│       ├── src/
│       │   ├── screens/          # Screen components
│       │   │   ├── LoginScreen.tsx
│       │   │   ├── SignupScreen.tsx
│       │   │   └── DashboardScreen.tsx
│       │   ├── navigation/       # Navigation setup
│       │   │   ├── AppNavigator.tsx
│       │   │   ├── AuthContext.tsx
│       │   │   └── stacks/       # Navigation stacks
│       │   ├── features/         # Feature modules
│       │   ├── services/         # API service layer
│       │   ├── shared/           # Shared components
│       │   ├── types/            # TypeScript types
│       │   └── utils/            # Utility functions
│       ├── App.tsx               # Root component
│       ├── app.json              # Expo configuration
│       └── package.json
│
├── packages/                     # Shared packages
│   ├── types/                    # Shared TypeScript types
│   │   ├── src/                 # Type definitions
│   │   └── package.json
│   ├── ui/                       # Shared UI components
│   │   ├── src/                 # Component source
│   │   ├── dist/                # Compiled components
│   │   └── package.json
│   ├── utils/                    # Shared utilities
│   │   ├── src/                 # Utility functions
│   │   └── package.json
│   └── config/                   # Shared configuration
│       ├── eslint.base.cjs      # ESLint config
│       ├── tailwind.base.cjs    # Tailwind config
│       ├── tsconfig.base.json   # TypeScript config
│       └── package.json
│
├── supabase/                     # Supabase configuration
│   └── migrations/              # Database migrations
│       ├── 0001_*.sql          # Migration files (numbered)
│       ├── 0002_*.sql
│       └── ...                  # Additional migrations
│
├── [Root Documentation Files]    # See "Additional Documentation" section
│
├── package.json                  # Root package.json
├── turbo.json                    # Turborepo configuration
├── pnpm-workspace.yaml          # pnpm workspace configuration
├── tsconfig.json                 # Root TypeScript config
└── setup-backend.sh              # Backend setup script
```

### Key Directories Explained

**Backend Routes** (`apps/backend/src/routes/`):
- `auth.ts` - Authentication endpoints
- `students.ts` - Student management
- `clerk-fees.ts` - Fee collection (Clerk)
- `attendance.ts` - Attendance tracking
- `exams.ts` - Examination system
- `salary.ts` - Salary management
- And more...

**Web Pages** (`apps/web/src/pages/`):
- `principal/` - Principal dashboard pages
- `clerk/` - Clerk dashboard pages
- `teacher/` - Teacher dashboard pages
- `student/` - Student dashboard pages

**Mobile Screens** (`apps/mobile/src/screens/`):
- Login, Signup, Dashboard screens
- Role-based navigation stacks

**Database Migrations** (`supabase/migrations/`):
- Numbered migration files (e.g., `0001_*.sql`, `0002_*.sql`)
- Applied sequentially to maintain database schema
```

## 📦 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** v20 or higher
- **pnpm** v10.22.0 or higher (package manager)
- **Supabase Account** (for database and authentication)
- **Git** (for version control)

### Installing pnpm

```bash
npm install -g pnpm@10.22.0
```

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd school
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo, including all apps and packages.

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project credentials:
   - Project URL
   - Anon Key
   - Service Role Key

3. Run database migrations:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or manually apply migrations from supabase/migrations/
```

### 4. Configure Environment Variables

#### Backend (`apps/backend/.env`)

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Server Configuration
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Redis (Optional - for caching)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

#### Web App (`apps/web/.env`)

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

#### Mobile App (`apps/mobile/.env`)

```env
API_URL=http://localhost:4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Build the Project

```bash
# Build all apps
pnpm build

# Or build individually
pnpm --filter backend build
pnpm --filter web build
```

### 6. Start Development Servers

```bash
# Start all apps in development mode
pnpm dev

# Or start individually
pnpm --filter backend dev    # Backend API (port 4000)
pnpm --filter web dev        # Web app (port 5173)
```

## 💻 Development

### Development Workflow

1. **Start all services**:
   ```bash
   pnpm dev
   ```

2. **Run type checking**:
   ```bash
   pnpm typecheck
   ```

3. **Run linting**:
   ```bash
   pnpm lint
   ```

### Working with the Monorepo

- **Run commands in specific packages**:
  ```bash
  pnpm --filter backend <command>
  pnpm --filter web <command>
  ```

- **Run commands in all packages**:
  ```bash
  pnpm <command>
  ```

### Code Structure Guidelines

- **Shared Code**: Place in `packages/` for reuse across apps
- **App-Specific Code**: Place in respective `apps/` directory
- **Types**: Define in `packages/types` and import where needed
- **Components**: Reusable components in `packages/ui`

## 🚢 Deployment

### Backend Deployment (AWS/Server)

See [AWS_BACKEND_SETUP.md](./AWS_BACKEND_SETUP.md) for detailed instructions.

Quick steps:
1. Set up environment variables on server
2. Build the backend: `pnpm --filter backend build`
3. Start with PM2: `pm2 start dist/index.js`
4. Configure reverse proxy (Nginx)

### Web App Deployment (Cloudflare Pages)

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for detailed instructions.

Quick steps:
1. Connect repository to Cloudflare Pages
2. Set build command: `pnpm install && pnpm --filter web build`
3. Set output directory: `apps/web/dist`
4. Configure environment variables

### Mobile App Deployment

1. Build for Android/iOS
2. Submit to app stores
3. Configure API endpoints for production

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Where Used |
|----------|-------------|------------|
| `SUPABASE_URL` | Supabase project URL | Backend, Web, Mobile |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Backend, Web, Mobile |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Backend only |
| `PORT` | Backend server port | Backend |
| `VITE_API_URL` | Backend API URL | Web |

### Optional Variables

| Variable | Description | Where Used |
|----------|-------------|------------|
| `UPSTASH_REDIS_REST_URL` | Redis URL for caching | Backend |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token | Backend |
| `NODE_ENV` | Environment (development/production) | Backend |

## 🗄 Database Migrations

Database migrations are located in `supabase/migrations/`. They are version-controlled and should be applied in order.

### Applying Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard SQL Editor
```

### Creating New Migrations

1. Create a new file: `supabase/migrations/XXXX_description.sql`
2. Write your SQL changes
3. Test locally
4. Commit and push

**Important**: Always test migrations in a development environment first!

## 📚 API Documentation

### Base URL

- **Development**: `http://localhost:4000`
- **Production**: `https://your-api-domain.com`

### Authentication

All API requests (except public endpoints) require authentication:

```http
Authorization: Bearer <jwt_token>
```

### Key Endpoints

- **Auth**: `/api/auth/*` - Authentication endpoints
- **Students**: `/api/students/*` - Student management
- **Fees**: `/api/clerk/fees/*` - Fee collection
- **Attendance**: `/api/attendance/*` - Attendance tracking
- **Exams**: `/api/exams/*` - Examination system
- **Salary**: `/api/salary/*` - Salary management

For detailed API documentation, see the API route files in `apps/backend/src/routes/`.

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Run tests and linting**: `pnpm typecheck && pnpm lint`
5. **Commit your changes**: `git commit -m "Add your feature"`
6. **Push to the branch**: `git push origin feature/your-feature`
7. **Open a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Write clear commit messages
- Add comments for complex logic

## 📝 Additional Documentation

- [FEATURES.md](./FEATURES.md) - Complete feature list
- [AWS_BACKEND_SETUP.md](./AWS_BACKEND_SETUP.md) - Backend deployment guide
- [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) - Frontend deployment guide
- [ATTENDANCE_SYSTEM_DESIGN.md](./ATTENDANCE_SYSTEM_DESIGN.md) - Attendance system documentation
- [EXAM_RESULT_SYSTEM_DESIGN.md](./EXAM_RESULT_SYSTEM_DESIGN.md) - Exam system documentation
- [COMPREHENSIVE_FEE_SYSTEM_DESIGN.md](./COMPREHENSIVE_FEE_SYSTEM_DESIGN.md) - Fee system documentation

## 🐛 Troubleshooting

### Common Issues

1. **Dependencies not installing**:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **TypeScript errors**:
   ```bash
   pnpm typecheck
   ```

3. **Database connection issues**:
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure migrations are applied

4. **Build failures**:
   ```bash
   pnpm clean
   pnpm install
   pnpm build
   ```

## 📄 License

[Add your license here]

## 👥 Team

[Add team information here]

## 🙏 Acknowledgments

[Add acknowledgments here]

---

**Last Updated**: February 2026  
**Version**: 1.0.0

For questions or support, please open an issue or contact the development team.
