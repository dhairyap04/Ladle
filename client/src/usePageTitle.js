import { useEffect } from "react";

// Sets the browser tab title, e.g. "Your impact · Ladle", so tabs, history and
// screen readers can tell pages apart.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Ladle` : "Ladle";
  }, [title]);
}
