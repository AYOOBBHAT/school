import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@school/ui';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import ForgotPassword from './pages/ForgotPassword';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ClerkDashboard from './pages/ClerkDashboard';
import AdminDashboard from './pages/AdminDashboard';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

function Navbar() {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Account for fixed navbar height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-blue-600">JhelumVerse</Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <a href="#features" onClick={(e) => handleScrollTo(e, 'features')} className="text-gray-700 hover:text-blue-600 cursor-pointer">Features</a>
            <a href="#demo" onClick={(e) => handleScrollTo(e, 'demo')} className="text-gray-700 hover:text-blue-600 cursor-pointer">Demo</a>
            <a href="#testimonials" onClick={(e) => handleScrollTo(e, 'testimonials')} className="text-gray-700 hover:text-blue-600 cursor-pointer">Testimonials</a>
            <a href="#faq" onClick={(e) => handleScrollTo(e, 'faq')} className="text-gray-700 hover:text-blue-600 cursor-pointer">FAQ</a>
            <Link to="/login" className="text-gray-700 hover:text-blue-600">Login</Link>
            <Link to="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Sign Up</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const handleRequestDemo = () => {
    const message = encodeURIComponent('Hello! I would like to request a demo of JhelumVerse School Management System.');
    const whatsappUrl = `https://wa.me/916005568502?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            All-In-One Cloud School Management System
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Manage attendance, fees, exams, reporting & more — in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/login" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition">
              Login
            </Link>
            <Link to="/signup" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
              Create School Now
            </Link>
          </div>
          <div className="mt-12 px-4">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-6xl mx-auto">
              <div className="relative w-full overflow-hidden rounded-lg" style={{ minHeight: '400px' }}>
                <img 
                  src="https://res.cloudinary.com/dv0l9h188/image/upload/v1763540151/jhelumVerse_fuvbtt.png" 
                  alt="JhelumVerse Dashboard Preview" 
                  className="w-full h-auto rounded-lg"
                  style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesOverview() {
  const features = [
    { icon: '🏫', title: 'Multi-Tenant for Multiple Schools', desc: 'Each school operates independently with complete data isolation' },
    { icon: '👥', title: 'Role-Based Dashboards', desc: 'Principal, Clerk, Teacher, Student, Parent — each with tailored views' },
    { icon: '📊', title: 'Attendance, Homework, Exams', desc: 'Track attendance, manage assignments, and generate report cards' },
    { icon: '💳', title: 'Fee Collection with UPI/Paytm/Razorpay', desc: 'Accept payments online with integrated payment gateways' },
    { icon: '💬', title: 'WhatsApp Chatbot for Parents', desc: 'Automated communication and updates via WhatsApp' },
    { icon: '📱', title: 'Mobile-First Design', desc: 'Fully responsive web app and native mobile apps' }
  ];

  return (
    <section id="features" className="py-20 bg-white scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesDeep() {
  const deepFeatures = [
    {
      title: 'Principal Dashboard',
      desc: 'Control everything',
      items: ['Manage staff & users', 'Create classes & sections', 'View analytics & reports', 'Configure school settings']
    },
    {
      title: 'Clerk Panel',
      desc: 'Fees and Marks Verification',
      items: ['Record fee payments', 'Issue receipts', 'Verify exam marks', 'Generate financial reports']
    },
    {
      title: 'Teacher Workspace',
      desc: 'Attendance + Lesson Plans',
      items: ['Mark daily attendance', 'Upload exam marks', 'View assigned classes', 'Track student progress']
    },
    {
      title: 'Student & Parent Apps',
      desc: 'Mobile first',
      items: ['View timetable & marks', 'Check fee status', 'Track attendance', 'Receive notifications']
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center mb-12">Powerful Features for Every Role</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {deepFeatures.map((f, i) => (
            <div key={i} className="bg-white rounded-lg p-8 shadow-md">
              <h3 className="text-2xl font-bold mb-2">{f.title}</h3>
              <p className="text-gray-600 mb-4">{f.desc}</p>
              <ul className="space-y-2">
                {f.items.map((item, j) => (
                  <li key={j} className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const testimonials = [
    { quote: 'Made our school fully digital in 48 hours.', author: 'Principal, ABC School', rating: 5 },
    { quote: 'The fee collection feature saved us hours every week.', author: 'Clerk, XYZ Academy', rating: 5 },
    { quote: 'Parents love the WhatsApp notifications!', author: 'Teacher, Sunshine School', rating: 5 }
  ];

  return (
    <section id="testimonials" className="py-20 bg-white scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center mb-12">What Our Users Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-6">
              <div className="flex mb-4">
                {[...Array(t.rating)].map((_, j) => (
                  <span key={j} className="text-yellow-400 text-xl">⭐</span>
                ))}
              </div>
              <p className="text-gray-700 mb-4 italic">"{t.quote}"</p>
              <p className="text-gray-600 font-semibold">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestDemo() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    schoolName: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = encodeURIComponent(
      `Hello! I would like to request a demo of JhelumVerse.\n\n` +
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Phone: ${formData.phone}\n` +
      `School Name: ${formData.schoolName}\n` +
      `Message: ${formData.message || 'I am interested in learning more about JhelumVerse.'}`
    );
    const whatsappUrl = `https://wa.me/916005568502?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    // Reset form
    setFormData({ name: '', email: '', phone: '', schoolName: '', message: '' });
  };

  return (
    <section id="demo" className="py-20 bg-white scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center mb-4">Request a Demo</h2>
        <p className="text-center text-gray-600 mb-8">
          Fill out the form below and we'll contact you on WhatsApp to schedule a personalized demo.
        </p>
        <div className="bg-gray-50 rounded-lg p-8 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+91 1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Name *</label>
                <input
                  type="text"
                  required
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ABC School"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Message (Optional)</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tell us more about your requirements..."
              />
            </div>
            <div className="text-center">
              <button
                type="submit"
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition inline-flex items-center gap-2"
              >
                <span>📱</span>
                Send via WhatsApp
              </button>
              <p className="text-sm text-gray-500 mt-4">
                Clicking this button will open WhatsApp with your message pre-filled
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    { q: 'Is it multi-branch?', a: 'Yes! Each school operates as an independent tenant with complete data isolation. You can manage multiple schools from a single platform.' },
    { q: 'How is data secured?', a: 'We use Supabase with Row Level Security (RLS) policies. Each school\'s data is isolated, and users can only access data within their school and role permissions.' },
    { q: 'Can teachers use via phone?', a: 'Absolutely! We have a React Native mobile app (Expo) that works on both iOS and Android. Teachers can mark attendance, upload marks, and more on the go.' }
  ];

  return (
    <section id="faq" className="py-20 bg-gray-50 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-2">{faq.q}</h3>
              <p className="text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4">JhelumVerse</h3>
            <p className="text-gray-400">All-in-one school management platform</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#features" onClick={(e) => handleScrollTo(e, 'features')} className="hover:text-white cursor-pointer">Features</a></li>
              <li><a href="#testimonials" onClick={(e) => handleScrollTo(e, 'testimonials')} className="hover:text-white cursor-pointer">Testimonials</a></li>
              <li><a href="#faq" onClick={(e) => handleScrollTo(e, 'faq')} className="hover:text-white cursor-pointer">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-400">
              <li><Link to="/terms" className="hover:text-white">Terms</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="https://wa.me/916005568502" target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp Support</a></li>
              <li><a href="mailto:ayoob324005@gmail.com" className="hover:text-white">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p>&copy; 2024 JhelumVerse. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-16">
        <Hero />
        <FeaturesOverview />
        <FeaturesDeep />
        <Testimonials />
        <RequestDemo />
        <FAQ />
        <Footer />
      </div>
    </div>
  );
}

function Parent() { return <div className="p-6">Parent: child progress, payments</div>; }

export default function App() {
  // Placeholder to ensure supabase used to avoid tree-shake confusion
  void supabase;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/principal/dashboard" element={<PrincipalDashboard />} />
      <Route path="/principal/staff" element={<PrincipalDashboard />} />
      <Route path="/principal/classifications" element={<PrincipalDashboard />} />
      <Route path="/principal/classes" element={<PrincipalDashboard />} />
      <Route path="/principal/subjects" element={<PrincipalDashboard />} />
      <Route path="/principal/students" element={<PrincipalDashboard />} />
      <Route path="/principal/exams" element={<PrincipalDashboard />} />
      <Route path="/principal/salary" element={<PrincipalDashboard />} />
      <Route path="/principal/fees" element={<PrincipalDashboard />} />
      <Route path="/clerk" element={<ClerkDashboard />} />
      <Route path="/clerk/fees" element={<ClerkDashboard />} />
      <Route path="/clerk/payments" element={<ClerkDashboard />} />
      <Route path="/clerk/salary" element={<ClerkDashboard />} />
      <Route path="/clerk/marks" element={<ClerkDashboard />} />
      <Route path="/teacher/classes" element={<TeacherDashboard />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/student/home" element={<StudentDashboard />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/parent" element={<Parent />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}


