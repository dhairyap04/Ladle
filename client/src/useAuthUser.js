import { useEffect, useState } from "react";
import api from "./api";

// The signed-in user ({ id, name, email, isFoodbank }), null for a guest,
// or undefined while the check is still in flight.
export default function useAuthUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    let active = true;
    api.get("user/isAuth")
      .then((res) => active && setUser(res.data))
      .catch(() => active && setUser(null));
    return () => { active = false; };
  }, []);
  return user;
}
