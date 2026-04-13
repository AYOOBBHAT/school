import { LegalLayout } from '../components/LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" effectiveLine="Effective Date: April 2026">
      <p>
        JhelumVerse (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates a school management platform and
        mobile application.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
        <p className="mb-2">We may collect the following types of information:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Personal Information: Name, email, phone number</li>
          <li>Student Information: Attendance, marks, class details</li>
          <li>Payment Information: Fee records (we do NOT store card/banking details)</li>
          <li>Device Information: App usage, logs</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Information</h2>
        <p className="mb-2">We use the collected data to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Manage school operations</li>
          <li>Track attendance and performance</li>
          <li>Process fee-related records</li>
          <li>Improve app functionality</li>
          <li>Provide support</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Sharing</h2>
        <p className="mb-2">We do NOT sell your data.</p>
        <p className="mb-2">We may share data with:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Schools using our platform</li>
          <li>Service providers (Supabase, Resend, hosting providers)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Security</h2>
        <p>We implement industry-standard security practices to protect your data.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Access</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Students can only access their own data</li>
          <li>Schools can access data related to their institution only</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Services</h2>
        <p className="mb-2">We use:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Supabase (database &amp; authentication)</li>
          <li>Railway / hosting services</li>
          <li>Email providers (Resend)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Children&apos;s Privacy</h2>
        <p>
          Our platform is used by schools. Data is managed by institutions, not directly collected from
          children.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes</h2>
        <p>We may update this policy. Updates will be reflected on this page.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact</h2>
        <p>
          For any questions:{' '}
          <a href="mailto:ayoob324005@gmail.com" className="text-blue-600 hover:underline">
            ayoob324005@gmail.com
          </a>
        </p>
      </section>

      <p className="pt-4 border-t border-gray-200 text-gray-600">
        By using JhelumVerse, you agree to this Privacy Policy.
      </p>
    </LegalLayout>
  );
}
