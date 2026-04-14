import { useEffect } from 'react';
import { LegalLayout } from '../components/LegalLayout';

export default function DeleteAccount() {
  useEffect(() => {
    document.title = 'Account Deletion - JhelumVerse';
  }, []);

  return (
    <LegalLayout title="Account Deletion - JhelumVerse">
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-gray-900">Delete Your Account</h2>
        <p>
          Users can request account deletion by contacting support. We will verify your request and
          delete your account and associated data.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-gray-900 mb-3">How to request deletion</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Send an email to:{' '}
            <a href="mailto:ayoob324005@gmail.com" className="text-blue-600 hover:underline">
              ayoob324005@gmail.com
            </a>
          </li>
          <li>Include your registered email and role (student / clerk / principal)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-gray-900 mb-3">What data will be deleted</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Account information</li>
          <li>Login credentials</li>
          <li>School-related data</li>
        </ul>
      </section>

      <section className="space-y-2">
        <p className="pt-4 border-t border-gray-200 text-gray-700">
          Deletion will be processed within 7 days.
        </p>
        <p className="text-gray-600">
          Some data may be retained for legal or security purposes.
        </p>
      </section>
    </LegalLayout>
  );
}

