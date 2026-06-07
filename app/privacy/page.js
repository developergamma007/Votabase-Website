export const metadata = {
  title: 'Privacy Policy & Child Safety Standards | Votabase',
  description:
    'Votabase privacy policy and published child safety standards against child sexual abuse and exploitation (CSAE).',
};

const SUPPORT_EMAILS = ['admin@iswot.in', 'venugopalagowda9999@gmail.com'];

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-policy-page">
      <div className="privacy-policy-page__inner">
        <header className="privacy-policy-page__header">
          <h1>Privacy Policy</h1>
          <p className="privacy-policy-page__meta">
            Effective date: 7 June 2026 · Service: Votabase (web and mobile apps)
          </p>
          <p className="privacy-policy-page__meta">
            This page is publicly published and includes our standards against child sexual abuse
            and exploitation (CSAE), as required by app store child safety policies.
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

        <section id="child-safety-standards">
          <h2>8. Child safety standards (CSAE)</h2>
          <p>
            Votabase maintains <strong>zero tolerance</strong> for child sexual abuse and exploitation
            (CSAE) and for any content, conduct, or use of our service that endangers minors. These
            published standards apply to the Votabase website and mobile application worldwide.
          </p>

          <h3>8.1 Purpose and audience</h3>
          <p>
            Votabase is a <strong>professional volunteer operations tool</strong> for authorized adult
            campaign and outreach workers. It is <strong>not</strong> a social network, dating service,
            or consumer app directed at children. Accounts are created only by program administrators
            for adults (typically 18 years or older) performing legitimate field work under
            organizational supervision.
          </p>

          <h3>8.2 Prohibited conduct and content</h3>
          <p>The following are strictly prohibited on Votabase:</p>
          <ul>
            <li>
              Creating, uploading, storing, sharing, or soliciting child sexual abuse material (CSAM)
              or any sexual content involving minors.
            </li>
            <li>
              Grooming, exploitation, trafficking, or any communication intended to abuse or exploit a
              child.
            </li>
            <li>
              Using voter or household records to target, contact, or harm minors in any unlawful way.
            </li>
            <li>
              Misrepresenting age or identity to obtain access, or allowing minors to use volunteer
              credentials.
            </li>
            <li>Any other activity that violates child protection laws or endangers minors.</li>
          </ul>

          <h3>8.3 Prevention and access controls</h3>
          <ul>
            <li>Login requires administrator-issued volunteer credentials; there is no open public signup.</li>
            <li>Role-based access limits which data each user can view or edit.</li>
            <li>
              Sensitive screens may use additional device protections (for example, discouraging
              screenshots on supported platforms).
            </li>
            <li>
              We do not operate public user-to-user messaging, open profiles, or open media sharing
              features that could be used to distribute abusive material.
            </li>
          </ul>

          <h3>8.4 Reporting child safety concerns</h3>
          <p>
            If you believe Votabase is being misused in a way that involves CSAE or puts a child at
            risk, report it immediately to us using the contacts below. Include as much detail as you
            can (account name, phone, date/time, and description). We treat urgent child-safety reports
            as highest priority.
          </p>
          <ul>
            {SUPPORT_EMAILS.map((email) => (
              <li key={`safety-${email}`}>
                <a href={`mailto:${email}?subject=Votabase%20Child%20Safety%20Report`}>{email}</a>
              </li>
            ))}
          </ul>
          <p>
            If a child is in immediate danger, contact <strong>local emergency services</strong> first,
            then notify us. In India you may also contact the National Cyber Crime Reporting Portal
            at <a href="https://cybercrime.gov.in" rel="noopener noreferrer">cybercrime.gov.in</a>.
          </p>

          <h3>8.5 Our response</h3>
          <ul>
            <li>
              We investigate credible reports promptly and may suspend or permanently disable accounts
              involved in suspected CSAE or child endangerment.
            </li>
            <li>
              We preserve relevant logs and cooperate with law enforcement and authorized child
              protection agencies as required by law.
            </li>
            <li>
              We do not allow users to edit or delete this published safety policy; changes are made
              only by ISWOT through an updated effective date on this page.
            </li>
          </ul>

          <h3>8.6 Children under 13</h3>
          <p>
            Votabase is not directed at children under 13, and we do not knowingly collect personal
            information from children under 13. If we learn that a child under 13 has been given
            account access, we will take steps to deactivate the account and delete associated data
            where appropriate.
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
          <p>For privacy questions, data requests, or child safety reports:</p>
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
