import { LegalLayout } from '../components/LegalLayout';

export default function TermsAndConditions() {
  return (
    <LegalLayout title="Terms & Conditions" effectiveLine="Effective Date: April 2026">
      <p>Welcome to JhelumVerse.</p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Usage</h2>
        <p>You agree to use the platform only for legitimate school-related activities.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Accounts</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Schools are responsible for managing their users</li>
          <li>Users must keep credentials secure</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Responsibility</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Schools own and manage their data</li>
          <li>We act as a service provider</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Payments</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Fee records are managed digitally</li>
          <li>We are not responsible for disputes between schools and students</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Availability</h2>
        <p>We aim for high uptime but do not guarantee uninterrupted service.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Termination</h2>
        <p>We may suspend accounts for misuse or policy violations.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
        <p className="mb-2">We are not liable for:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Data loss due to misuse</li>
          <li>Financial disputes</li>
          <li>Unauthorized access due to weak credentials</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes</h2>
        <p>We may update these terms at any time.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact</h2>
        <p>
          <a href="mailto:ayoob324005@gmail.com" className="text-blue-600 hover:underline">
            ayoob324005@gmail.com
          </a>
        </p>
      </section>

      <p className="pt-4 border-t border-gray-200 text-gray-600">
        By using JhelumVerse, you agree to these Terms.
      </p>
    </LegalLayout>
  );
}
