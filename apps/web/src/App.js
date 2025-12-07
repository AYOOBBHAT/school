import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import ForgotPassword from './pages/ForgotPassword';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ClerkDashboard from './pages/ClerkDashboard';
import ClerkFeeCollection from './pages/ClerkFeeCollection';
import AdminDashboard from './pages/AdminDashboard';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
function Navbar() {
    const handleScrollTo = (e, id) => {
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
    return (_jsx("nav", { className: "bg-white shadow-sm border-b fixed w-full top-0 z-50", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsx("div", { className: "flex items-center", children: _jsx(Link, { to: "/", className: "text-2xl font-bold text-blue-600", children: "JhelumVerse" }) }), _jsxs("div", { className: "hidden md:flex space-x-8", children: [_jsx("a", { href: "#features", onClick: (e) => handleScrollTo(e, 'features'), className: "text-gray-700 hover:text-blue-600 cursor-pointer", children: "Features" }), _jsx("a", { href: "#demo", onClick: (e) => handleScrollTo(e, 'demo'), className: "text-gray-700 hover:text-blue-600 cursor-pointer", children: "Demo" }), _jsx("a", { href: "#testimonials", onClick: (e) => handleScrollTo(e, 'testimonials'), className: "text-gray-700 hover:text-blue-600 cursor-pointer", children: "Testimonials" }), _jsx("a", { href: "#faq", onClick: (e) => handleScrollTo(e, 'faq'), className: "text-gray-700 hover:text-blue-600 cursor-pointer", children: "FAQ" }), _jsx(Link, { to: "/login", className: "text-gray-700 hover:text-blue-600", children: "Login" }), _jsx(Link, { to: "/signup", className: "bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700", children: "Sign Up" })] })] }) }) }));
}
function Hero() {
    const handleRequestDemo = () => {
        const message = encodeURIComponent('Hello! I would like to request a demo of JhelumVerse School Management System.');
        const whatsappUrl = `https://wa.me/916005568502?text=${message}`;
        window.open(whatsappUrl, '_blank');
    };
    return (_jsx("section", { className: "bg-gradient-to-br from-blue-50 to-indigo-100 py-20", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-5xl font-bold text-gray-900 mb-4", children: "All-In-One Cloud School Management System" }), _jsx("p", { className: "text-xl text-gray-600 mb-8 max-w-2xl mx-auto", children: "Manage attendance, fees, exams, reporting & more \u2014 in one place." }), _jsxs("div", { className: "flex gap-4 justify-center", children: [_jsx(Link, { to: "/login", className: "bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition", children: "Login" }), _jsx(Link, { to: "/signup", className: "bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition", children: "Create School Now" })] }), _jsx("div", { className: "mt-12 px-4", children: _jsx("div", { className: "bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-6xl mx-auto", children: _jsx("div", { className: "relative w-full overflow-hidden rounded-lg", style: { minHeight: '400px' }, children: _jsx("img", { src: "https://res.cloudinary.com/dv0l9h188/image/upload/v1763540151/jhelumVerse_fuvbtt.png", alt: "JhelumVerse Dashboard Preview", className: "w-full h-auto rounded-lg", style: { display: 'block', maxWidth: '100%', height: 'auto' }, crossOrigin: "anonymous" }) }) }) })] }) }) }));
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
    return (_jsx("section", { id: "features", className: "py-20 bg-white scroll-mt-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-4xl font-bold text-center mb-12", children: "Key Features" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: features.map((f, i) => (_jsxs("div", { className: "bg-gray-50 rounded-lg p-6 hover:shadow-lg transition", children: [_jsx("div", { className: "text-4xl mb-4", children: f.icon }), _jsx("h3", { className: "text-xl font-semibold mb-2", children: f.title }), _jsx("p", { className: "text-gray-600", children: f.desc })] }, i))) })] }) }));
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
    return (_jsx("section", { className: "py-20 bg-gray-50", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-4xl font-bold text-center mb-12", children: "Powerful Features for Every Role" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: deepFeatures.map((f, i) => (_jsxs("div", { className: "bg-white rounded-lg p-8 shadow-md", children: [_jsx("h3", { className: "text-2xl font-bold mb-2", children: f.title }), _jsx("p", { className: "text-gray-600 mb-4", children: f.desc }), _jsx("ul", { className: "space-y-2", children: f.items.map((item, j) => (_jsxs("li", { className: "flex items-center", children: [_jsx("span", { className: "text-green-500 mr-2", children: "\u2713" }), _jsx("span", { children: item })] }, j))) })] }, i))) })] }) }));
}
function Testimonials() {
    const testimonials = [
        { quote: 'Made our school fully digital in 48 hours.', author: 'Principal, ABC School', rating: 5 },
        { quote: 'The fee collection feature saved us hours every week.', author: 'Clerk, XYZ Academy', rating: 5 },
        { quote: 'Parents love the WhatsApp notifications!', author: 'Teacher, Sunshine School', rating: 5 }
    ];
    return (_jsx("section", { id: "testimonials", className: "py-20 bg-white scroll-mt-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-4xl font-bold text-center mb-12", children: "What Our Users Say" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-8", children: testimonials.map((t, i) => (_jsxs("div", { className: "bg-gray-50 rounded-lg p-6", children: [_jsx("div", { className: "flex mb-4", children: [...Array(t.rating)].map((_, j) => (_jsx("span", { className: "text-yellow-400 text-xl", children: "\u2B50" }, j))) }), _jsxs("p", { className: "text-gray-700 mb-4 italic", children: ["\"", t.quote, "\""] }), _jsxs("p", { className: "text-gray-600 font-semibold", children: ["\u2014 ", t.author] })] }, i))) })] }) }));
}
function RequestDemo() {
    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        phone: '',
        schoolName: '',
        message: ''
    });
    const handleSubmit = (e) => {
        e.preventDefault();
        const message = encodeURIComponent(`Hello! I would like to request a demo of JhelumVerse.\n\n` +
            `Name: ${formData.name}\n` +
            `Email: ${formData.email}\n` +
            `Phone: ${formData.phone}\n` +
            `School Name: ${formData.schoolName}\n` +
            `Message: ${formData.message || 'I am interested in learning more about JhelumVerse.'}`);
        const whatsappUrl = `https://wa.me/916005568502?text=${message}`;
        window.open(whatsappUrl, '_blank');
        // Reset form
        setFormData({ name: '', email: '', phone: '', schoolName: '', message: '' });
    };
    return (_jsx("section", { id: "demo", className: "py-20 bg-white scroll-mt-20", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-4xl font-bold text-center mb-4", children: "Request a Demo" }), _jsx("p", { className: "text-center text-gray-600 mb-8", children: "Fill out the form below and we'll contact you on WhatsApp to schedule a personalized demo." }), _jsx("div", { className: "bg-gray-50 rounded-lg p-8 shadow-md", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Your Name *" }), _jsx("input", { type: "text", required: true, value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "John Doe" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email *" }), _jsx("input", { type: "email", required: true, value: formData.email, onChange: (e) => setFormData({ ...formData, email: e.target.value }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "john@example.com" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Phone Number *" }), _jsx("input", { type: "tel", required: true, value: formData.phone, onChange: (e) => setFormData({ ...formData, phone: e.target.value }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "+91 1234567890" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "School Name *" }), _jsx("input", { type: "text", required: true, value: formData.schoolName, onChange: (e) => setFormData({ ...formData, schoolName: e.target.value }), className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "ABC School" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Additional Message (Optional)" }), _jsx("textarea", { value: formData.message, onChange: (e) => setFormData({ ...formData, message: e.target.value }), rows: 4, className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Tell us more about your requirements..." })] }), _jsxs("div", { className: "text-center", children: [_jsxs("button", { type: "submit", className: "bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition inline-flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCF1" }), "Send via WhatsApp"] }), _jsx("p", { className: "text-sm text-gray-500 mt-4", children: "Clicking this button will open WhatsApp with your message pre-filled" })] })] }) })] }) }));
}
function FAQ() {
    const faqs = [
        { q: 'Is it multi-branch?', a: 'Yes! Each school operates as an independent tenant with complete data isolation. You can manage multiple schools from a single platform.' },
        { q: 'How is data secured?', a: 'We use Supabase with Row Level Security (RLS) policies. Each school\'s data is isolated, and users can only access data within their school and role permissions.' },
        { q: 'Can teachers use via phone?', a: 'Absolutely! We have a React Native mobile app (Expo) that works on both iOS and Android. Teachers can mark attendance, upload marks, and more on the go.' }
    ];
    return (_jsx("section", { id: "faq", className: "py-20 bg-gray-50 scroll-mt-20", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("h2", { className: "text-4xl font-bold text-center mb-12", children: "Frequently Asked Questions" }), _jsx("div", { className: "space-y-6", children: faqs.map((faq, i) => (_jsxs("div", { className: "bg-white rounded-lg p-6 shadow-md", children: [_jsx("h3", { className: "text-xl font-semibold mb-2", children: faq.q }), _jsx("p", { className: "text-gray-600", children: faq.a })] }, i))) })] }) }));
}
function Footer() {
    const handleScrollTo = (e, id) => {
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
    return (_jsx("footer", { className: "bg-gray-900 text-white py-12", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-2xl font-bold mb-4", children: "JhelumVerse" }), _jsx("p", { className: "text-gray-400", children: "All-in-one school management platform" })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-4", children: "Product" }), _jsxs("ul", { className: "space-y-2 text-gray-400", children: [_jsx("li", { children: _jsx("a", { href: "#features", onClick: (e) => handleScrollTo(e, 'features'), className: "hover:text-white cursor-pointer", children: "Features" }) }), _jsx("li", { children: _jsx("a", { href: "#testimonials", onClick: (e) => handleScrollTo(e, 'testimonials'), className: "hover:text-white cursor-pointer", children: "Testimonials" }) }), _jsx("li", { children: _jsx("a", { href: "#faq", onClick: (e) => handleScrollTo(e, 'faq'), className: "hover:text-white cursor-pointer", children: "FAQ" }) })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-4", children: "Legal" }), _jsxs("ul", { className: "space-y-2 text-gray-400", children: [_jsx("li", { children: _jsx(Link, { to: "/terms", className: "hover:text-white", children: "Terms" }) }), _jsx("li", { children: _jsx(Link, { to: "/privacy", className: "hover:text-white", children: "Privacy Policy" }) })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-4", children: "Support" }), _jsxs("ul", { className: "space-y-2 text-gray-400", children: [_jsx("li", { children: _jsx("a", { href: "https://wa.me/916005568502", target: "_blank", rel: "noopener noreferrer", className: "hover:text-white", children: "WhatsApp Support" }) }), _jsx("li", { children: _jsx("a", { href: "mailto:ayoob324005@gmail.com", className: "hover:text-white", children: "Contact Us" }) })] })] })] }), _jsx("div", { className: "mt-8 pt-8 border-t border-gray-800 text-center text-gray-400", children: _jsx("p", { children: "\u00A9 2024 JhelumVerse. All rights reserved." }) })] }) }));
}
function Home() {
    return (_jsxs("div", { className: "min-h-screen", children: [_jsx(Navbar, {}), _jsxs("div", { className: "pt-16", children: [_jsx(Hero, {}), _jsx(FeaturesOverview, {}), _jsx(FeaturesDeep, {}), _jsx(Testimonials, {}), _jsx(RequestDemo, {}), _jsx(FAQ, {}), _jsx(Footer, {})] })] }));
}
function Parent() { return _jsx("div", { className: "p-6", children: "Parent: child progress, payments" }); }
export default function App() {
    // Placeholder to ensure supabase used to avoid tree-shake confusion
    void supabase;
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/reset-password", element: _jsx(ResetPassword, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPassword, {}) }), _jsx(Route, { path: "/principal/dashboard", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/staff", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/classifications", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/classes", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/subjects", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/students", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/exams", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/salary", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/principal/fees", element: _jsx(PrincipalDashboard, {}) }), _jsx(Route, { path: "/clerk/dashboard", element: _jsx(ClerkDashboard, {}) }), _jsx(Route, { path: "/clerk", element: _jsx(ClerkDashboard, {}) }), _jsx(Route, { path: "/clerk/fee-collection", element: _jsx(ClerkFeeCollection, {}) }), _jsx(Route, { path: "/clerk/fees", element: _jsx(ClerkDashboard, {}) }), _jsx(Route, { path: "/clerk/payments", element: _jsx(ClerkDashboard, {}) }), _jsx(Route, { path: "/clerk/marks", element: _jsx(ClerkDashboard, {}) }), _jsx(Route, { path: "/teacher/classes", element: _jsx(TeacherDashboard, {}) }), _jsx(Route, { path: "/teacher", element: _jsx(TeacherDashboard, {}) }), _jsx(Route, { path: "/student/home", element: _jsx(StudentDashboard, {}) }), _jsx(Route, { path: "/student", element: _jsx(StudentDashboard, {}) }), _jsx(Route, { path: "/parent", element: _jsx(Parent, {}) }), _jsx(Route, { path: "/admin/dashboard", element: _jsx(AdminDashboard, {}) }), _jsx(Route, { path: "/admin", element: _jsx(AdminDashboard, {}) })] }));
}
