import { motion } from "framer-motion";
import Image from "next/image";
export function RegisterContent() {
  return (
    <div className="signup-hero-container">
      {/* Main Content */}
      <div className="signup-hero-content relative z-10">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="signup-brand-header"
        >
          <Image
            src="/logo-primary-dark.svg"
            alt="mktask AI Work Management"
            width={320}
            height={80}
            priority
            className="mb-8 h-auto w-48 lg:w-64"
          />

          <h2 className="signup-hero-heading">
            Start your journey to
            <br />
            <span className="signup-hero-heading-gradient">effortless productivity</span>
          </h2>

          <p className="signup-hero-description">
            Create your free account today and discover why thousands of teams choose mktask to
            streamline their workflow and achieve more.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
