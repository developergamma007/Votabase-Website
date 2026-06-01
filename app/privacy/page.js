export const metadata = {
  title: 'Privacy Policy | Votabase',
  description: 'How Votabase collects, uses, and protects information for authorized volunteer accounts.',
};

const SUPPORT_EMAILS = ['admin@iswot.in', 'venugopalagowda9999@gmail.com'];

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-policy-page">
      <div className="privacy-policy-page__inner">
        <header className="privacy-policy-page__header">
          <h1>Privacy Policy</h1>
          <p className="privacy-policy-page__meta">
            Effective date: 31 May 2026 · Service: Votabase (web and mobile apps)
          </p>
        </header>

        <section>
          <h2>1. Who we are</h2>
          <p>
            Votabase is operated by ISWOT (&quot;we&quot;, &quot;us&quot;) for authorized election outreach
            and volunteer programs. This policy explains how we handle information when you use the
            Votabase website (<strong>https://votabase.iswot.in/ui</strong>) and the Votabase mobile application.
          </p>
        </section>

        <section>
          <h2>2. Who this applies to</h2>
          <p>
            Access is limited to volunteers and administrators registered by your organization.
            Voter records are used only for legitimate campaign or outreach activities permitted
            under applicable law and your program rules.
          </p>
        </section>

        <section>
          <h2>3. Information we collect</h2>
          <ul>
            <li>
              <strong>Account data:</strong> first name, mobile number, role, assembly/ward/booth
              assignment, and authentication tokens when you sign in.
            </li>
            <li>
              <strong>Voter and household data:</strong> names, EPIC numbers, booth details,
              contact fields, visit status, and family/household information entered by authorized
              users during field work.
            </li>
            <li>
              <strong>Location:</strong> device location when you capture household positions,
              meeting attendance, or map features (with your permission on the device).
            </li>
            <li>
              <strong>Profile photo:</strong> if you choose to upload a profile image.
            </li>
            <li>
              <strong>Technical data:</strong> app version, device type, and server logs needed for
              security and troubleshooting.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. How we use information</h2>
          <ul>
            <li>Authenticate users and enforce role-based access (booth, ward, assembly, admin).</li>
            <li>Support voter search, visit tracking, family management, maps, meetings, and reporting.</li>
            <li>Improve reliability and prevent fraud or unauthorized access.</li>
            <li>Comply with legal obligations and respond to support requests.</li>
          </ul>
        </section>

        <section>
          <h2>5. Sharing</h2>
          <p>
            We do not sell personal information. Data may be shared with hosting and infrastructure
            providers that process data on our behalf under contract, or when required by law. Access
            within your organization is controlled by administrator-assigned roles.
          </p>
        </section>

        <section>
          <h2>6. Retention and security</h2>
          <p>
            Data is retained for the duration of your program and as required by law or contract.
            We use HTTPS, access controls, and audit fields (such as updated-by name and phone) on
            sensitive records. No method of transmission over the internet is 100% secure; we work to
            protect data using reasonable industry practices.
          </p>
        </section>

        <section>
          <h2>7. Your choices</h2>
          <ul>
            <li>You may deny location permission; some features (maps, attendance) will not work.</li>
            <li>Contact us to correct account details or request deactivation of your volunteer login.</li>
            <li>Voter data corrections should be submitted through your program administrator.</li>
          </ul>
        </section>

        <section>
          <h2>8. Children</h2>
          <p>
            Votabase is not directed at children under 13. Accounts are created only for authorized
            adult volunteers and administrators.
          </p>
        </section>

        <section>
          <h2>9. Changes</h2>
          <p>
            We may update this policy from time to time. The effective date at the top will change
            when we do. Continued use after updates means you accept the revised policy.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>For privacy questions or requests:</p>
          <ul>
            {SUPPORT_EMAILS.map((email) => (
              <li key={email}>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            ))}
          </ul>
        </section>

        <p className="privacy-policy-page__footer">
          <a href="/ui/login">Back to sign in</a>
        </p>
      </div>
    </main>
  );
}
