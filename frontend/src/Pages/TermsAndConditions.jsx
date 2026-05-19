// frontend/src/pages/TermsAndConditions.jsx
import React, { useState } from "react";
import styles from "./TermsAndConditions.module.css";

const TermsAndConditions = () => {
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const termsData = [
    {
      id: 1,
      title: "1. Introduction",
      content: (
        <div>
          <p>
            Welcome to Izozo. These Terms and Conditions govern your access to and
            use of our website and services. By registering, accessing, or using
            our platform, you agree to comply with and be bound by these Terms.
          </p>
          <p>
            If you do not agree with any part of these Terms, you must not use our
            services.
          </p>
        </div>
      ),
    },
    {
      id: 2,
      title: "2. Nature of Services",
      content: (
        <div>
          <p>
            Izozo provides digital commerce support services including but not
            limited to:
          </p>
          <ul>
            <li>Creating and managing online product listings</li>
            <li>Managing customer enquiries</li>
            <li>Assisting with order coordination and delivery arrangements</li>
            <li>Tracking orders, payments, and performance analytics</li>
            <li>Supporting sales conducted through platforms such as Facebook, Instagram, WhatsApp, or other online channels</li>
          </ul>
          <p>
            Izozo acts as a service facilitator and does not manufacture or own
            the products sold by merchants.
          </p>
        </div>
      ),
    },
    {
      id: 3,
      title: "3. Eligibility",
      content: (
        <div>
          <p>To use our services, you must:</p>
          <ul>
            <li>Be at least 18 years old</li>
            <li>Provide accurate business and contact information</li>
            <li>Operate a lawful business within South Africa</li>
            <li>Have authority to sell the products listed</li>
          </ul>
        </div>
      ),
    },
    {
      id: 4,
      title: "4. Merchant Responsibilities",
      content: (
        <div>
          <p>By signing up, you agree that:</p>
          <ul>
            <li>All products listed are legal and authentic.</li>
            <li>Product descriptions, pricing, and availability provided are accurate.</li>
            <li>You will fulfil orders promptly and maintain product quality.</li>
            <li>You are responsible for stock availability and product warranties.</li>
            <li>You will comply with applicable consumer protection laws.</li>
          </ul>
          <p>
            Izozo reserves the right to remove listings that violate laws or
            platform standards.
          </p>
        </div>
      ),
    },
    {
      id: 5,
      title: "5. Payments and Fees",
      content: (
        <div>
          <p>
            Izozo operates on a performance-based payment model, unless otherwise
            agreed in writing.
          </p>
          
          {/* Admin Fee Table */}
          <div className={styles.feesSection}>
            <div className={styles.tableWrapper}>
              <table className={styles.feesTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Admin Fee</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Small items (clothing, accessories)</td>
                    <td className={styles.feeAmount}>R5</td>
                  </tr>
                  <tr>
                    <td>Medium items (boxed goods, shoes)</td>
                    <td className={styles.feeAmount}>R10</td>
                  </tr>
                  <tr>
                    <td>Large/bulky (furniture, bulk food)</td>
                    <td className={styles.feeAmount}>R20</td>
                  </tr>
                  <tr>
                    <td>Perishable (food)</td>
                    <td className={styles.feeAmount}>R10 + urgency factor</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ul>
            <li>Fees are charged only when sales are successfully completed.</li>
            <li>Payment structures, commission percentages, or service charges will be communicated separately.</li>
            <li>No upfront or monthly fees apply unless specified in a separate agreement.</li>
            <li><strong>Failure to settle agreed fees may result in suspension of services.</strong></li>
            <li>Payments are to be made weekly to the SMME's after deductions.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 6,
      title: "6. Trial Period",
      content: (
        <div>
          <p>Where applicable:</p>
          <ul>
            <li>Merchants may list up to five (5) products during a trial period.</li>
            <li>Trial duration is 30 days unless otherwise stated.</li>
            <li>Izozo may terminate or extend the trial at its discretion.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 7,
      title: "7. Deliveries and Logistics",
      content: (
        <div>
          <p>
            Izozo may assist in coordinating deliveries but is not liable for
            courier delays, losses, or damages caused by third-party logistics
            providers.
          </p>
          <p>
            Merchants remain responsible for packaging and product condition
            before dispatch.
          </p>
          <p>
            <strong>SMMEs are responsible for payments of the agents.</strong>
          </p>
        </div>
      ),
    },
    {
      id: 8,
      title: "8. Customer Communications",
      content: (
        <div>
          <p>
            Izozo agents may communicate with customers on behalf of merchants to
            manage enquiries and sales conversions.
          </p>
          <p>
            Merchants authorize Izozo to represent their business professionally
            for this purpose.
          </p>
        </div>
      ),
    },
    {
      id: 9,
      title: "9. Intellectual Property",
      content: (
        <div>
          <p>
            All website content, branding, systems, and materials remain the
            property of Izozo unless otherwise stated.
          </p>
          <p>
            Merchants grant Izozo permission to use product images, logos, and
            descriptions for marketing and sales purposes.
          </p>
        </div>
      ),
    },
    {
      id: 10,
      title: "10. Prohibited Products",
      content: (
        <div>
          <p>The following may not be listed:</p>
          <ul>
            <li>Illegal or counterfeit goods</li>
            <li>Dangerous or restricted items</li>
            <li>Products violating South African law</li>
            <li>Offensive or harmful materials</li>
          </ul>
          <p>
            Izozo reserves the right to remove prohibited listings without notice.
          </p>
        </div>
      ),
    },
    {
      id: 11,
      title: "11. Limitation of Liability",
      content: (
        <div>
          <p>Izozo shall not be liable for:</p>
          <ul>
            <li>Loss of profits or indirect damages</li>
            <li>Customer disputes relating to product quality</li>
            <li>Delivery delays caused by third parties</li>
            <li>Business losses resulting from platform downtime</li>
          </ul>
          <p>Services are provided on an "as-is" basis.</p>
        </div>
      ),
    },
    {
      id: 12,
      title: "12. Suspension or Termination",
      content: (
        <div>
          <p>Izozo may suspend or terminate accounts if:</p>
          <ul>
            <li>False information is provided</li>
            <li>Fees remain unpaid</li>
            <li>Illegal or unethical conduct occurs</li>
            <li>Terms are violated</li>
          </ul>
          <p>Users may terminate participation by providing written notice.</p>
        </div>
      ),
    },
    {
      id: 13,
      title: "13. Privacy",
      content: (
        <div>
          <p>
            Personal information is processed according to applicable South
            African data protection laws (POPIA).
          </p>
          <p>
            Information collected is used only to provide services and improve
            operations.
          </p>
        </div>
      ),
    },
    {
      id: 14,
      title: "14. Changes to Terms and Conditions",
      content: (
        <div>
          <p>
            Izozo reserves the right to update these Terms and Conditions at any
            time.
          </p>
          <p>
            Continued use of the platform constitutes acceptance of revised Terms
            and Conditions.
          </p>
        </div>
      ),
    },
    {
      id: 15,
      title: "15. Governing Law",
      content: (
        <p>
          These Terms and Conditions shall be governed by the laws of the
          Republic of South Africa.
        </p>
      ),
    },
    {
      id: 16,
      title: "16. Contact Information",
      content: (
        <div>
          <p>For questions regarding these Terms:</p>
          <ul className={styles.contactList}>
            <li>📧 Email: support@izozo.co.za</li>
            <li>🌐 Website: https://www.izozo.co.za</li>
            <li>🏠 Address: 1204 Park Street, Ditsela Place, Hatfield, Pretoria, 0028</li>
            <li>📞 Phone: +27 81 252 4406</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.termsContainer}>
      <div className="container">
        {/* Header Section */}
        <div className={styles.headerSection}>
          <h1 className={styles.mainTitle}>TERMS AND CONDITIONS</h1>
          <p className={styles.effectiveDate}>Effective Date: January 2026</p>
          <p className={styles.websiteUrl}>Website: https://www.izozo.co.za</p>
          <p className={styles.companyName}>Company Name: Izozo (Pty) Ltd</p>
        </div>

        {/* Content Card */}
        <div className={styles.contentCard}>
          {/* Accordion Sections */}
          <div className={styles.accordion}>
            {termsData.map((section) => (
              <div key={section.id} className={styles.accordionItem}>
                <button
                  className={`${styles.accordionHeader} ${openSections[section.id] ? styles.active : ''}`}
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{section.title}</span>
                  <span className={styles.accordionIcon}>
                    {openSections[section.id] ? '−' : '+'}
                  </span>
                </button>
                {openSections[section.id] && (
                  <div className={styles.accordionContent}>
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;