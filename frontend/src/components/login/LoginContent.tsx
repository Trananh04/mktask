import { motion } from "framer-motion";
import Image from "next/image";

export function LoginContent() {
  return (
    <div className="login-hero-container">
      {/* Main Content */}
      <div className="login-hero-content">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="login-brand-header"
        >
          <Image
            src="/logo-primary-dark.svg"
            alt="mktask AI Work Management"
            width={320}
            height={80}
            priority
            className="mb-8 h-auto w-48 lg:w-64"
          />

          <h2 className="login-hero-heading">
            Tối ưu
            <br />
            <span className="login-hero-heading-gradient">quy trình đội nhóm</span>
          </h2>

          <p className="login-hero-description">
            Quản lý dự án hiệu quả hơn với công cụ AI thích ứng theo cách làm việc của đội nhóm.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
