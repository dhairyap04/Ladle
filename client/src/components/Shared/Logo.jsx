import { Link } from "react-router-dom";
import { brand } from "../../theme";

// The Ladle mark with its wordmark. Links home unless `to` is null.
const Logo = ({ to = "/", size = 36, showText = true }) => {
  const content = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <img src="/images/logo-mark.svg" alt="" width={size} height={size} />
      {showText && (
        <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: "-0.02em", lineHeight: 1 }}>
          <span style={{ color: brand.leafDark }}>Ladle</span>
        </span>
      )}
    </span>
  );
  if (to === null) return content;
  return (
    <Link to={to} aria-label="Ladle home" style={{ textDecoration: "none", display: "inline-flex" }}>
      {content}
    </Link>
  );
};

export default Logo;
