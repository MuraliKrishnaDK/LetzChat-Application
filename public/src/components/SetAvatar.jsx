import React, { useEffect, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import loader from "../assets/loader.gif";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { setAvatarRoute } from "../utils/APIRoutes";
import { createAvatar } from "@dicebear/core";
import { personas } from "@dicebear/collection";

/** Personas collection — illustrated characters; each row in the table is a slice of generated seeds */
const AVATAR_STYLE = personas;
const AVATAR_COUNT = 20;
const TABLE_COLUMNS = 5;

function svgToBase64(svg) {
  return btoa(unescape(encodeURIComponent(svg)));
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default function SetAvatar() {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState(undefined);

  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  useEffect(() => {
    const user = localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY);
    if (!user) navigate("/login");
  }, [navigate]);

  const generateRandomName = () => Math.random().toString(36).substring(2, 10);

  useEffect(() => {
    const generateAvatars = () => {
      const data = [];
      const base = Date.now();
      for (let i = 0; i < AVATAR_COUNT; i++) {
        const seed = `${generateRandomName()}-${base}-${i}`;
        const svg = createAvatar(AVATAR_STYLE, {
          seed,
          size: 128,
        }).toString();
        data.push(svgToBase64(svg));
      }
      setAvatars(data);
      setIsLoading(false);
    };

    generateAvatars();
  }, []);

  const setProfilePicture = async () => {
    if (selectedAvatar === undefined) {
      toast.error("Please select an avatar", toastOptions);
      return;
    }

    const user = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    const { data } = await axios.post(`${setAvatarRoute}/${user._id}`, {
      image: avatars[selectedAvatar],
    });

    if (data.isSet) {
      user.isAvatarImageSet = true;
      user.avatarImage = data.image;
      localStorage.setItem(
        process.env.REACT_APP_LOCALHOST_KEY,
        JSON.stringify(user)
      );
      navigate("/");
    } else {
      toast.error("Error setting avatar. Please try again.", toastOptions);
    }
  };

  const rows = chunkArray(avatars, TABLE_COLUMNS);

  return (
    <>
      {isLoading ? (
        <Container>
          <img src={loader} alt="loader" className="loader" />
        </Container>
      ) : (
        <Container>
          <div className="title-container">
            <h1>Pick your profile picture</h1>
            <p className="subtitle">
              Personas collection — select a cell in the table below
            </p>
          </div>

          <div className="avatar-table-wrap">
            <table className="avatar-table">
              <caption className="table-caption">
                Avatar options (Personas). Each row has {TABLE_COLUMNS}{" "}
                choices.
              </caption>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((avatar, colIndex) => {
                      const index = rowIndex * TABLE_COLUMNS + colIndex;
                      return (
                        <td key={index}>
                          <button
                            type="button"
                            className={`avatar-cell ${
                              selectedAvatar === index ? "selected" : ""
                            }`}
                            onClick={() => setSelectedAvatar(index)}
                            aria-pressed={selectedAvatar === index}
                            aria-label={`Select Personas avatar ${index + 1}`}
                          >
                            <img
                              src={`data:image/svg+xml;base64,${avatar}`}
                              alt=""
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={setProfilePicture} className="submit-btn">
            Set as Profile Picture
          </button>
          <ToastContainer />
        </Container>
      )}
    </>
  );
}

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 1.75rem;
  background-color: #171717;
  min-height: 100vh;
  width: 100vw;
  padding: 1.5rem 0 2rem;
  box-sizing: border-box;

  .loader {
    max-inline-size: 100%;
  }

  .title-container {
    text-align: center;
    flex-shrink: 0;

    h1 {
      color: white;
      margin: 0 0 0.5rem;
      font-size: clamp(1.25rem, 4vw, 1.75rem);
    }

    .subtitle {
      color: #a3a3a3;
      margin: 0;
      font-size: 0.95rem;
    }
  }

  .avatar-table-wrap {
    width: 100%;
    max-width: min(36rem, calc(100vw - 2rem));
    max-height: min(60vh, 28rem);
    overflow: auto;
    border-radius: 0.5rem;
    border: 1px solid #404040;
    background: #1f1f1f;
    box-sizing: border-box;
  }

  .avatar-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;

    .table-caption {
      caption-side: top;
      padding: 0.65rem 0.75rem;
      font-size: 0.8rem;
      color: #a3a3a3;
      text-align: left;
      border-bottom: 1px solid #404040;
    }

    tbody tr {
      border-bottom: 1px solid #333;

      &:last-child {
        border-bottom: none;
      }
    }

    td {
      padding: 0.5rem;
      text-align: center;
      vertical-align: middle;
      border-right: 1px solid #333;

      &:last-child {
        border-right: none;
      }
    }
  }

  .avatar-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 5.25rem;
    margin: 0 auto;
    padding: 0.35rem;
    border: 0.3rem solid transparent;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease,
      transform 0.2s ease;
    aspect-ratio: 1;

    img {
      width: 100%;
      height: 100%;
      max-height: 4.5rem;
      object-fit: contain;
      pointer-events: none;
    }

    &:hover {
      transform: scale(1.05);
    }

    &:focus-visible {
      outline: 2px solid #d4d4d4;
      outline-offset: 2px;
    }

    &.selected {
      border-color: #9ca3af;
      box-shadow: 0 0 0 1px rgba(156, 163, 175, 0.45);
    }
  }

  .submit-btn {
    flex-shrink: 0;
    background-color: #6b7280;
    color: white;
    padding: 1rem 2rem;
    border: none;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0.4rem;
    font-size: 1rem;
    text-transform: uppercase;

    &:hover {
      background-color: #6b7280;
    }
  }
`;
