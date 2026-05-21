import { motion } from "framer-motion";
import Image from "next/image";

export function SetupContent() {
  return (
    <div className="setup-hero-container">
      {/* Main Content */}
      <div className="setup-hero-content">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="setup-brand-header"
        >
          <Image
            src="/logo-primary-dark.svg"
            alt="mktask AI Work Management"
            width={320}
            height={80}
            priority
            className="mb-8 h-auto w-48 lg:w-64"
          />

          <h2 className="setup-hero-heading">
            Begin your
            <br />
            <span className="setup-hero-heading-gradient">productivity journey</span>
          </h2>

          <p className="setup-hero-description">
            Set up your super admin account to unlock the full power of mktask's
            AI-powered project management platform for your entire organization.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
