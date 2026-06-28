import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { loginRoute } from "../utils/APIRoutes";
import { brandLogoUrl } from "../brand";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ username: "", password: "" });
  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };
  useEffect(() => {
    if (localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)) {
      navigate("/");
      return;
    }
    // Show confirmation toast once after account deletion, then clean the URL
    if (new URLSearchParams(location.search).get("deleted") === "1") {
      toast.success("Your account has been deleted successfully.", {
        ...toastOptions,
        autoClose: 3000,
      });
      window.history.replaceState(null, "", "/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
  };

  const validateForm = () => {
    const { username, password } = values;
    if (username === "") {
      toast.error("Email and Password is required.", toastOptions);
      return false;
    } else if (password === "") {
      toast.error("Email and Password is required.", toastOptions);
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    try {
      const { username, password } = values;
      const { data } = await axios.post(loginRoute, {
        username,
        password,
      });
      if (data.status === false) {
        toast.error(data.msg, toastOptions);
        return;
      }
      localStorage.setItem(
        process.env.REACT_APP_LOCALHOST_KEY,
        JSON.stringify(data.user)
      );
      navigate("/");
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.", toastOptions);
    }
  };

  return (
    <>
      <FormContainer>
        <form action="" onSubmit={(event) => handleSubmit(event)}>
          <div className="brand">
            <img src={brandLogoUrl} alt="" className="brand-logo" width={44} height={44} />
            <h1>LetzChat</h1>
          </div>
          <input
            type="text"
            placeholder="Username"
            name="username"
            onChange={(e) => handleChange(e)}
            min="3"
          />
          <input
            type="password"
            placeholder="Password"
            name="password"
            onChange={(e) => handleChange(e)}
          />
          <button type="submit">Log In</button>
          <span className="reset-link">
            <Link to="/reset-password">Reset password via email</Link>
          </span>
          <span>
            Don't have an account ? <Link to="/register">Create One.</Link>
          </span>
        </form>
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
    gap: 2rem;
    background-color: #00000076;
    border-radius: 2rem;
    padding: 5rem;
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
    &:hover {
      background-color: #6b7280;
    }
  }
  span {
    color: white;
    text-transform: uppercase;
    text-align: center;
    a {
      color: #6b7280;
      text-decoration: none;
      font-weight: bold;
      display: inline-block;
      padding: 0.5rem 1.1rem;
      border-radius: 9999px;
      transition: background-color 0.15s, color 0.15s;
      &:hover {
        background-color: #6b728028;
        color: #9ca3af;
      }
    }
  }

  .reset-link {
    text-transform: none;
    font-size: 0.85rem;
    a {
      text-transform: none;
      padding: 0.25rem 0.5rem;
    }
  }
`;
