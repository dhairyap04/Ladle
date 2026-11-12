import { useEffect, useState } from "react";
import api from "./api";

// The last signed-in user, kept on the device so the app still knows who's
// signed in when it's opened without signal (for example a driver at a
// loading dock). Cleared on sign-out and whenever the server says no.
const KEY = "ladle.user";
const readCached = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};
const writeCached = (user) => {
  try {
    if (user) window.localStorage.setItem(KEY, JSON.stringify(user));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: offline sign-in just won't be remembered.
  }
};
export const forgetCachedUser = () => writeCached(null);

// The signed-in user ({ id, name, email, role, isFoodbank, isAdmin }), null for a guest,
// or undefined while the check is still in flight.
export default function useAuthUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    let active = true;
    api.get("user/isAuth")
      .then((res) => {
        const { id, name, email, role, isFoodbank, isAdmin } = res.data;
        writeCached({ id, name, email, role, isFoodbank, isAdmin });
        if (active) setUser(res.data);
      })
      .catch((err) => {
        // No response at all: offline. Trust the last known sign-in.
        if (!err.response) {
          if (active) setUser(readCached());
          return;
        }
        writeCached(null);
        if (active) setUser(null);
      });
    return () => { active = false; };
  }, []);
  return user;
}
