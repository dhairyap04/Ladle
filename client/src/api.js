import axios from "axios";

// One axios instance so every request goes to the API with the auth cookies.
const api = axios.create({
  baseURL: process.env.REACT_APP_HOST_URL,
  withCredentials: true,
});

// Turns an axios error into a sentence that can be shown to the user.
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const data = err && err.response && err.response.data;
  if (data && typeof data.msg === "string") return data.msg;
  if (typeof data === "string" && data.length < 200) return data;
  if (err && !err.response) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

export default api;
