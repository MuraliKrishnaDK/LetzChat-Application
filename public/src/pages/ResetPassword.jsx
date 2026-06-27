import React, { useEffect, useState } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  requestPasswordResetRoute,
  verifyPasswordResetRoute,
  resetPasswordRoute,
} from "../utils/APIRoutes";
import { brandLogoUrl } from "../brand";

const RESET_EMAIL_KEY = "letzchat_reset_email";
const RESET_CODE_KEY = "letzchat_reset_code";

const toastOptions = {
  position: "bottom-right",
  autoClose: 8000,
  pauseOnHover: true,
  draggable: true,
  theme: "dark",
};

function BrandHeader() {
  return (
    <div className="brand">
      <img src={brandLogoUrl} alt="" className="brand-logo" width={44} height={44} />
      <h1>LetzChat</h1>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const step =
    location.pathname.endsWith("/new")
      ? "new"
      : location.pathname.endsWith("/code")
        ? "code"
        : "email";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem(RESET_EMAIL_KEY);
    const storedCode = sessionStorage.getItem(RESET_CODE_KEY);
    if (storedEmail) setEmail(storedEmail);
    if (storedCode) setCode(storedCode);

    if (step === "code" && !storedEmail) {
      navigate("/reset-password", { replace: true });
    }
    if (step === "new" && (!storedEmail || !storedCode)) {
      navigate("/reset-password", { replace: true });
    }
  }, [step, navigate]);

  const requestCode = async (event) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Email is required.", toastOptions);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(requestPasswordResetRoute, {
        email: trimmed,
      });
      if (!data.status) {
        toast.error(data.msg, toastOptions);
        return;
      }
      sessionStorage.setItem(RESET_EMAIL_KEY, trimmed.toLowerCase());
      sessionStorage.removeItem(RESET_CODE_KEY);
      if (data.devCode) {
        toast.info(`Dev reset code: ${data.devCode}`, {
          ...toastOptions,
          autoClose: 30000,
        });
      } else {
        toast.success(data.msg, toastOptions);
      }
      navigate("/reset-password/code");
    } catch {
      toast.error("Could not send reset code. Try again.", toastOptions);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    const trimmedCode = code.trim();
    const trimmedEmail = (
      email.trim() || sessionStorage.getItem(RESET_EMAIL_KEY) || ""
    ).toLowerCase();
    if (!trimmedCode) {
      toast.error("Enter the 6-digit code from your email.", toastOptions);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(verifyPasswordResetRoute, {
        email: trimmedEmail,
        code: trimmedCode,
      });
      if (!data.status) {
        toast.error(data.msg, toastOptions);
        return;
      }
      sessionStorage.setItem(RESET_EMAIL_KEY, trimmedEmail);
      sessionStorage.setItem(RESET_CODE_KEY, trimmedCode);
      toast.success("Code verified.", toastOptions);
      navigate("/reset-password/new");
    } catch {
      toast.error("Could not verify code. Try again.", toastOptions);
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    const trimmedEmail = (
      email.trim() || sessionStorage.getItem(RESET_EMAIL_KEY) || ""
    ).toLowerCase();
    const trimmedCode = code.trim() || sessionStorage.getItem(RESET_CODE_KEY);

    if (!trimmedCode) {
      toast.error("Reset session expired. Start again.", toastOptions);
      navigate("/reset-password", { replace: true });
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.", toastOptions);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.", toastOptions);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(resetPasswordRoute, {
        email: trimmedEmail,
        code: trimmedCode,
        password,
      });
      if (!data.status) {
        toast.error(data.msg, toastOptions);
        return;
      }
      sessionStorage.removeItem(RESET_EMAIL_KEY);
      sessionStorage.removeItem(RESET_CODE_KEY);
      toast.success(data.msg, toastOptions);
      navigate("/login", { replace: true });
    } catch {
      toast.error("Could not reset password. Try again.", toastOptions);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FormContainer>
        {step === "email" && (
          <form onSubmit={requestCode}>
            <BrandHeader />
            <p className="hint">
              Enter your account email. We will send a 6-digit reset code.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </button>
            <span>
              Remember your password? <Link to="/login">Log in.</Link>
            </span>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode}>
            <BrandHeader />
            <p className="hint">
              Enter the 6-digit code sent to{" "}
              <strong>{email || sessionStorage.getItem(RESET_EMAIL_KEY)}</strong>
            </p>
            <input
              type="text"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Verify code"}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate("/reset-password")}
              disabled={loading}
            >
              Use a different email
            </button>
          </form>
        )}

        {step === "new" && (
          <form onSubmit={submitNewPassword}>
            <BrandHeader />
            <p className="hint">Code verified. Set your new password.</p>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Reset password"}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate("/reset-password/code")}
              disabled={loading}
            >
              Back to code entry
            </button>
          </form>
        )}
      </FormContainer>
      <ToastContainer />
    </>
  );
}

const FormContainer = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  background-color: #171717;

  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    .brand-logo {
      height: 2.75rem;
      width: auto;
      max-width: 3.5rem;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
    }
    h1 {
      color: white;
      font-weight: 600;
      font-size: 1.75rem;
      letter-spacing: -0.02em;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background-color: #00000076;
    border-radius: 2rem;
    padding: 4rem 5rem;
    max-width: 28rem;
    width: 100%;
  }

  .hint {
    color: #9ca3af;
    font-size: 0.9rem;
    text-align: center;
    margin: 0;
    line-height: 1.4;
    strong {
      color: #e5e7eb;
    }
  }

  input {
    background-color: transparent;
    padding: 1rem;
    border: 0.1rem solid #6b7280;
    border-radius: 0.875rem;
    color: white;
    width: 100%;
    font-size: 1rem;
    &:focus {
      border: 0.1rem solid #6b7280;
      outline: none;
    }
  }

  button {
    background-color: #6b7280;
    color: white;
    padding: 1rem 2rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 9999px;
    font-size: 1rem;
    text-transform: uppercase;
    &:hover:not(:disabled) {
      background-color: #4b5563;
    }
    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }

  .link-btn {
    background: transparent;
    text-transform: none;
    font-size: 0.9rem;
    padding: 0.5rem;
  }

  span {
    color: white;
    text-transform: uppercase;
    text-align: center;
    font-size: 0.85rem;
    a {
      color: #6b7280;
      text-decoration: none;
      font-weight: bold;
      &:hover {
        color: #9ca3af;
      }
    }
  }
`;
