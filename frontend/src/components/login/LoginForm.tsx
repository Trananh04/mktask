import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api, { TokenManager } from "@/lib/api";
import { authApi } from "@/utils/api/authApi";
import Script from "next/script";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Shield } from "lucide-react";
import Image from "next/image";
interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
  const { login, checkOrganizationAndRedirect } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [ssoConfig, setSsoConfig] = useState<{ enabled: boolean; configured: boolean; providerName: string } | null>(null);

  useEffect(() => {
    api.get("/auth/registration-status")
      .then((res) => setRegistrationEnabled(res.data?.enabled !== false))
      .catch(() => setRegistrationEnabled(true));

    api.get("/auth/oidc/config")
      .then((res) => setSsoConfig(res.data))
      .catch(() => setSsoConfig(null));

    // Handle SSO callback — exchange httpOnly cookie for tokens securely
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") === "callback") {
      // Clean URL immediately
      window.history.replaceState({}, document.title, "/login");

      api.post("/auth/oidc/exchange")
        .then(async (res) => {
          const { access_token, refresh_token, user } = res.data;
          if (access_token && refresh_token) {
            TokenManager.setAccessToken(access_token);
            TokenManager.setRefreshToken(refresh_token);
            if (user) localStorage.setItem("user", JSON.stringify(user));
            // Use org check to determine correct redirect.
            const redirectPath = await checkOrganizationAndRedirect();
            window.location.href = redirectPath;
          } else {
            setError("Không thể xử lý đăng nhập SSO");
          }
        })
        .catch(() => setError("Xác thực SSO thất bại. Vui lòng thử lại."));
    }

    const ssoError = params.get("error");
    if (ssoError === "sso_failed" || ssoError === "sso_invalid_state") {
      window.history.replaceState({}, document.title, "/login");
      setError(params.get("message") || "Xác thực SSO thất bại. Vui lòng thử lại.");
    }
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ email: formData.email, password: formData.password });
      const redirectPath = await checkOrganizationAndRedirect();
      router.push(redirectPath);
    } catch (err: any) {
      const isNetworkError = Boolean(err?.isNetworkError) || !err?.response;
      const status = err?.response?.status;

      if (isNetworkError) {
        setError("Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.");
      } else if (status === 401) {
        setError("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
      } else if (status === 403 && err?.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
      }

      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (response: any) => {
    setIsLoading(true);
    setError("");
    try {
      await authApi.loginWithGoogle(response.credential);
      const redirectPath = await checkOrganizationAndRedirect();
      window.location.href = redirectPath;
    } catch (err: any) {
      console.error("Google login error:", err);
      setError("Đăng nhập bằng Google thất bại. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const initGoogleLogin = () => {
    if (typeof window !== "undefined" && window.google?.accounts?.id && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
      });
      const btnContainer = document.getElementById("google-signin-btn");
      if (btnContainer) {
        window.google.accounts.id.renderButton(
          btnContainer,
          { theme: "outline", size: "large", type: "standard", shape: "rectangular", text: "signin_with", width: btnContainer.offsetWidth || 250 } 
        );
      }
    }
  };

  useEffect(() => {
    // Re-initialize on mount if script is already loaded
    initGoogleLogin();
    
    // Listen for resize to re-render button with correct width if needed (optional)
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="login-form-container"
    >
      {/* Header */}
      <div className="signup-form-header  flex justify-center items-center flex-col">
        {/* Mobile Logo */}

        <div className="signup-mobile-logo">
          <div className="signup-mobile-logo-icon">
            <Image
              src="/logo-mark.svg"
              alt="mktask Logo"
              width={50}
              height={50}
              className="size-10"
            />
          </div>
        </div>

        <div className="login-form-header-content">
          <h1 className="login-form-title">
            {/* Show as flex row on max-md, block on md+ */}
            <div className="md:hidden">
              Chào mừng trở lại
              <span className="flex items-center justify-center ">mktask </span>
            </div>

            {/* Block for md+ */}
            <span className="hidden md:block">Chào mừng trở lại</span>
          </h1>
          <p className="login-form-subtitle">Đăng nhập để tiếp tục công việc của bạn</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertDescription className="font-medium">
              <span className="login-error-title">Xác thực thất bại</span>
              <span className="login-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="login-form">
        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="login-field-container"
        >
          <Label htmlFor="email" className="login-field-label">
            <Mail className="login-field-icon" />
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
            placeholder="Nhập địa chỉ email"
            className="login-input"
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-field-container"
        >
          <Label htmlFor="password" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>Mật khẩu</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu"
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
        </motion.div>

        {/* Options Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="login-options-row"
        >
          <div className="login-remember-me-container">
            <Checkbox
              id="rememberMe"
              name="rememberMe"
              checked={formData.rememberMe}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  rememberMe: Boolean(checked),
                }))
              }
              className="login-remember-me-checkbox"
            />
            <Label htmlFor="rememberMe" className="login-remember-me-label">
              Ghi nhớ đăng nhập
            </Label>
          </div>
          <Link href="/forgot-password" className="login-forgot-password-link">
            Quên mật khẩu?
          </Link>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button type="submit" disabled={isLoading} className="login-submit-button">
            {isLoading ? (
              <>
                <Loader2 className="login-loading-spinner" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                Đăng nhập
                <ArrowRight className="login-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Google Login Script */}
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive" 
        onLoad={initGoogleLogin}
      />

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="login-divider-container"
      >
        <div className="login-divider-line">
          <div className="login-divider-border" />
        </div>
        <div className="login-divider-text-container" style={{ position: 'absolute', background: 'var(--background)', padding: '0 8px' }}>
          <span className="login-divider-text text-muted-foreground text-sm">Hoặc tiếp tục với</span>
        </div>
      </motion.div>

      {/* Google Login Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex justify-center w-full mt-4 mb-4"
      >
        <div id="google-signin-btn" className="w-full flex justify-center"></div>
      </motion.div>

      {/* SSO Login Button */}
      {ssoConfig?.enabled && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Button
              type="button"
              variant="outline"
              className="login-signup-button"
              disabled={!ssoConfig.configured}
              onClick={() => {
                if (ssoConfig.configured) {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api"}/auth/oidc/login`;
                }
              }}
            >
              <Shield className="w-4 h-4 mr-2" />
              {ssoConfig.providerName || "Đăng nhập bằng SSO"}
              {!ssoConfig.configured && (
                <span className="text-xs ml-1 opacity-60">(chưa cấu hình)</span>
              )}
            </Button>
          </motion.div>
        </>
      )}

      {/* Divider + Sign Up Link (only when registration is enabled) */}
      {registrationEnabled && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="login-divider-container"
          >
            <div className="login-divider-line">
              <div className="login-divider-border" />
            </div>
            <div className="login-divider-text-container">
              <span className="login-divider-text">Bạn mới dùng mktask?</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Link href="/register">
              <Button variant="outline" className="login-signup-button">
                Tạo tài khoản mới
                <ArrowRight className="login-button-arrow" />
              </Button>
            </Link>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
