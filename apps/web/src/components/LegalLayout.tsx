import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  effectiveLine?: string;
  children: ReactNode;
};

export function LegalLayout({ title, effectiveLine, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-xl font-bold text-blue-600">
            JhelumVerse
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-gray-600">
            <Link to="/" className="hover:text-blue-600">
              Home
            </Link>
            <Link to="/terms" className="hover:text-blue-600">
              Terms
            </Link>
            <Link to="/privacy-policy" className="hover:text-blue-600">
              Privacy Policy
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        {effectiveLine ? <p className="text-gray-600 mb-8">{effectiveLine}</p> : null}
        <div className="space-y-8 text-gray-700 leading-relaxed">{children}</div>
      </main>
    </div>
  );
}
