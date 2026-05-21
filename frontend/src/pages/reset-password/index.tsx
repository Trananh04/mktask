import { useAuth } from "@/contexts/auth-context";
import AuthRedirect from "@/components/auth/AuthRedirect";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  ArrowRight,
  Shield,
} from "lucide-react";
import { LoginContent } from "@/components/login/LoginContent";
import { ModeToggle } from "@/components/header/ModeToggle";
import { ResetPasswordData } from "@/types";

function ResetPasswordForm() {
  const router = useRouter();
  const { token } = router.query;
  const { resetPassword, validateResetToken } = useAuth();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  // Password validation helpers - disabled to match backend
  const isPasswordLongEnough = true; // formData.password.length >= 8;
  const hasUpperCase = true; // /[A-Z]/.test(formData.password);
  const hasLowerCase = true; // /[a-z]/.test(formData.password);
  const hasNumber = true; // /\d/.test(formData.password);
  const passwordsMatch =
    formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  const isPasswordValid = true; // isPasswordLongEnough && hasUpperCase && hasLowerCase && hasNumber;

  useEffect(() => {
    // Validate token on component mount
    const checkToken = async () => {
      if (!token || typeof token !== "string") {
        setIsValidToken(false);
        setError("Liên kết đặt lại mật khẩu không hợp lệ hoặc bị thiếu");
        return;
      }

      try {
        const response: any = await validateResetToken(token);
        if (response) {
          setIsValidToken(response?.valid);
        } else {
          setIsValidToken(false);
          setError(response.message || "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
        }
      } catch (err: any) {
        setIsValidToken(false);
        setError(err.message || "Không thể kiểm tra liên kết đặt lại mật khẩu");
      }
    };

    if (token) {
      checkToken();
    }
  }, [token]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      if (error) setError("");
    },
    [error]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation disabled
    // if (!isPasswordValid) {
    //   setError("Password must meet all requirements");
    //   setIsLoading(false);
    //   return;
    // }

    if (!passwordsMatch) {
      setError("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }

    if (!token || typeof token !== "string") {
      setError("Liên kết đặt lại mật khẩu không hợp lệ");
      setIsLoading(false);
      return;
    }

    try {
      const resetData: ResetPasswordData = {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      };

      const response = await resetPassword(resetData);

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
      }
    } catch (err: any) {
      setError(err.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };
  if (!isValidToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="login-form-container"
      >
        {/* Invalid Token Header */}
        <div className="login-form-header">
          <div className="login-form-header-content">
            <h1 className="login-form-title">Liên kết đặt lại không hợp lệ</h1>
            <p className="login-form-subtitle">
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn
            </p>
          </div>
        </div>

        {/* Error Alert */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertCircle className="login-field-icon" />
            <AlertDescription className="font-medium">
              <span className="login-error-title">Liên kết đã hết hạn</span>
              <span className="login-error-message">
                Liên kết này có thể đã hết hạn hoặc đã được sử dụng. Liên kết đặt lại mật khẩu chỉ có hiệu lực trong 24 giờ.
              </span>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/forgot-password">
            <Button className="login-submit-button">
              Yêu cầu liên kết mới
              <ArrowRight className="login-button-arrow" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/login">
            <Button variant="outline" className="login-signup-button">
              Quay lại đăng nhập
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="login-form-container"
      >
        {/* Success Header */}
        <div className="login-form-header">
          <div className="login-form-header-content">
            <h1 className="login-form-title">Đặt lại mật khẩu thành công</h1>
            <p className="login-form-subtitle">Mật khẩu của bạn đã được cập nhật</p>
          </div>
        </div>

        {/* Success Alert */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert className="login-error-alert border-green-200 bg-green-50 text-green-800 dark:border-green-800/30 dark:bg-green-900/20">
            <CheckCircle2 className="login-field-icon text-green-600" />
            <AlertDescription className="font-medium">
              <span className="login-error-title text-green-800 dark:text-green-200">Hoàn tất!</span>
              <span className="login-error-message text-green-700 dark:text-green-300">
                Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.
              </span>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* Sign In Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/login">
            <Button className="login-submit-button">
              Đăng nhập ngay
              <ArrowRight className="login-button-arrow" />
            </Button>
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-footer"
        >
          <p className="login-footer-text">
            Gặp khó khăn khi đăng nhập?{" "}
            <Link href="/support" className="login-footer-link">
              Liên hệ hỗ trợ
            </Link>
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="login-form-container"
    >
      {/* Header */}
      <div className="login-form-header">
        <div className="login-form-header-content">
          <h1 className="login-form-title">Đặt mật khẩu mới</h1>
          <p className="login-form-subtitle">Tạo mật khẩu mạnh cho tài khoản của bạn</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertCircle className="login-field-icon" />
            <AlertDescription className="font-medium">
              <span className="login-error-title">Đặt lại mật khẩu thất bại</span>
              <span className="login-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="login-form">
        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="login-field-container"
        >
          <Label htmlFor="password" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>Mật khẩu mới</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Tạo mật khẩu mạnh"
              className="login-password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="login-password-toggle"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {/* Password Requirements - Disabled */}
          {/* {formData.password && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="signup-password-requirements"
            >
              <p className="signup-requirements-header">
                <Shield className="login-field-icon" />
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
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-field-container"
        >
          <Label htmlFor="confirmPassword" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>Xác nhận mật khẩu mới</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Nhập lại mật khẩu mới"
              className="login-password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="login-password-toggle"
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

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button
            type="submit"
            disabled={isLoading || !isPasswordValid || !passwordsMatch}
            className="login-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="login-loading-spinner" />
                Đang cập nhật mật khẩu...
              </>
            ) : (
              <>
                Đặt lại mật khẩu
                <ArrowRight className="login-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="login-footer"
      >
        <p className="login-footer-text">
          Bạn nhớ mật khẩu rồi?{" "}
          <Link href="/login" className="login-footer-link">
            Quay lại đăng nhập
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  const { checkOrganizationAndRedirect } = useAuth();

  const redirectTo = async () => {
    return await checkOrganizationAndRedirect();
  };

  return (
    <AuthRedirect redirectTo={redirectTo}>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="min-h-screen flex bg-[var(--background)]">
          <div className="lg:w-1/2 relative">
            <LoginContent />
          </div>
          <div className="login-form-mode-toggle">
            <ModeToggle />
          </div>
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
            <div className="w-full max-w-md">
              <ResetPasswordForm />
            </div>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
}
