import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
  Loader2,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export function RegisterForm() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const searchParams = useSearchParams();
  const { register, checkOrganizationAndRedirect } = useAuth();
  const initialEmail = searchParams.get("email") ?? "";
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: initialEmail,
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
      if (error) setError("");
    },
    [error]
  );

  // Password validation helpers
  const isPasswordLongEnough = true;                    // formData.password.length >= 8;
  const hasUpperCase = true;                            // /[A-Z]/.test(formData.password);
  const hasLowerCase = true;                            // /[a-z]/.test(formData.password);
  const hasNumber = true;                                   // /\d/.test(formData.password);
  const passwordsMatch =
    formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  const isPasswordValid = true;
  // isPasswordLongEnough && hasUpperCase && hasLowerCase && hasNumber;

  // All required fields check
  const allFieldsFilled = [
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.password,
    formData.confirmPassword,
  ].every((field) => typeof field === "string" && field.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isPasswordValid) {
      setError("Mật khẩu chưa đáp ứng yêu cầu");
      setIsLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }

    if (!formData.acceptTerms) {
      setError("Bạn cần đồng ý với điều khoản sử dụng");
      setIsLoading(false);
      return;
    }

    const invitationToken = localStorage.getItem("pendingInvitation") || undefined;
    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        ...(invitationToken && { invitationToken }),
      };

      const response = await register(userData);

      if (response.access_token) {
        // Check if user has an organization and redirect accordingly
        const redirectPath = await checkOrganizationAndRedirect();
        router.push(redirectPath);
      } else {
        router.push("/login?message=Đăng ký thành công. Vui lòng đăng nhập.");
      }
    } catch (err: any) {
      const message = err.message || "Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại.";
      setError(message);

      // If registration was disabled and the invitation token didn't help,
      // clear the stale token so the user isn't stuck in a loop
      if (invitationToken && message.toLowerCase().includes("registration is currently disabled")) {
        localStorage.removeItem("pendingInvitation");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="signup-form-container"
    >
      {/* Header */}
      <div className="signup-form-header">
        {/* Mobile Logo */}
        <div className="signup-mobile-logo">
          <div className="signup-mobile-logo-icon">
            <Image
              src="/mktask-logo.png"
              alt="mktask Logo"
              width={50}
              height={50}
              className={`size-10 ${
                resolvedTheme === "light" ? " filter invert brightness-200" : ""
              }`}
            />
          </div>
        </div>

        <h1 className="signup-form-title">Tạo tài khoản</h1>
        <p className="signup-form-subtitle">Tham gia cùng các đội nhóm đang sử dụng mktask</p>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="mb-6"
        >
          <Alert variant="destructive" className="signup-error-alert">
            <AlertCircle className="signup-error-icon" />
            <AlertDescription className="font-medium">
              <span className="signup-error-title">Đăng ký thất bại</span>
              <span className="signup-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="signup-form">
        {/* Name Fields */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="signup-name-fields"
        >
          <div className="signup-field-container">
            <Label htmlFor="firstName" className="signup-field-label">
              <User className="signup-field-icon" />
              <span>Tên</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Anh"
              className="signup-input"
            />
          </div>
          <div className="signup-field-container">
            <Label htmlFor="lastName" className="signup-field-label-simple">
              Họ
            </Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Trần"
              className="signup-input"
            />
          </div>
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="signup-field-container"
        >
          <Label htmlFor="email" className="signup-field-label">
            <Mail className="signup-field-icon" />
            <span>Địa chỉ email</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="ten@congty.com"
            className="signup-input"
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="signup-field-container"
        >
          <Label htmlFor="password" className="signup-field-label">
            <Lock className="signup-field-icon" />
            <span>Mật khẩu</span>
          </Label>
          <div className="signup-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Tạo mật khẩu mạnh"
              className={`signup-password-input ${
                formData.password && !isPasswordValid ? "border-red-500 ring-1 ring-red-500" : ""
              }`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="signup-password-toggle"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {/* Password Requirements
          {formData.password && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="signup-password-requirements"
            >
              <p className="signup-requirements-header">
                <Shield className="signup-field-icon" />
                <span>Password Requirements:</span>
              </p>
              <div className="signup-requirements-grid">
                <div
                  className={`signup-requirement-item ${
                    isPasswordLongEnough ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      isPasswordLongEnough
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>8+ characters</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasUpperCase ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasUpperCase
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Uppercase letter</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasLowerCase ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasLowerCase
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Lowercase letter</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasNumber ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasNumber
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Number</span>
                </div>
              </div>
            </motion.div>
          )} */}
        </motion.div>

        {/* Confirm Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="signup-field-container"
        >
          <Label htmlFor="confirmPassword" className="signup-field-label">
            <Lock className="signup-field-icon" />
            <span>Xác nhận mật khẩu</span>
          </Label>
          <div className="signup-password-container">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Nhập lại mật khẩu"
              className={`signup-password-input ${
                formData.confirmPassword && !passwordsMatch
                  ? "border-red-500 ring-1 ring-red-500"
                  : ""
              }`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="signup-password-toggle"
              aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {formData.confirmPassword && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`signup-password-match ${
                passwordsMatch ? "signup-password-match-valid" : "signup-password-match-invalid"
              }`}
            >
              <CheckCircle2
                className={
                  passwordsMatch
                    ? "signup-password-match-icon-valid"
                    : "signup-password-match-icon-invalid"
                }
              />
              <span>{passwordsMatch ? "Mật khẩu khớp" : "Mật khẩu không khớp"}</span>
            </motion.div>
          )}
        </motion.div>

        {/* Terms Checkbox */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="signup-terms-container"
        >
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                acceptTerms: Boolean(checked),
              }))
            }
            required
            className="signup-terms-checkbox"
          />
          <Label htmlFor="acceptTerms" className="signup-terms-label">
            Tôi đồng ý với{" "}
            <Link href="/terms-of-service" className="signup-terms-link">
              Điều khoản dịch vụ
            </Link>{" "}
            và{" "}
            <Link href="/privacy-policy" className="signup-terms-link">
              Chính sách quyền riêng tư
            </Link>
          </Label>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button
            type="submit"
            disabled={
              isLoading ||
              !allFieldsFilled ||
              !isPasswordValid ||
              !passwordsMatch ||
              !formData.acceptTerms
            }
            className="signup-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="signup-loading-spinner" />
                Đang tạo tài khoản...
              </>
            ) : (
              <>
                Tạo tài khoản
                <ArrowRight className="signup-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="signup-divider-container"
      >
        <div className="signup-divider-inner">
          <div className="signup-divider-line">
            <div className="signup-divider-border" />
          </div>
          <div className="signup-divider-text-container">
            <span className="signup-divider-text">Bạn đã có tài khoản?</span>
          </div>
        </div>
      </motion.div>

      {/* Sign In Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Link href="/login">
          <Button variant="outline" className="signup-signin-button">
            Đăng nhập vào tài khoản hiện có
            <ArrowRight className="signup-button-arrow" />
          </Button>
        </Link>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="signup-footer"
      >
        <p className="signup-footer-text">
          Khi tạo tài khoản, bạn đồng ý với{" "}
          <Link href="/terms-of-service" className="signup-footer-link">
            Điều khoản dịch vụ
          </Link>{" "}
          và{" "}
          <Link href="/privacy-policy" className="signup-footer-link">
            Chính sách quyền riêng tư
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
