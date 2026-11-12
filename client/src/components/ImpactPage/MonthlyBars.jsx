import { useState } from "react";
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

const monthLabel = (key, style = "short") =>
  new Date(`${key}-01T12:00:00Z`).toLocaleDateString([], { month: style, timeZone: "UTC", ...(style === "long" ? { year: "numeric" } : {}) });

// Donations per month as a single-series column chart, with a hover/focus
// tooltip on each column and a table view for screen readers and exact values.
const MonthlyBars = ({ months, unit = "donations" }) => {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const value = (m) => (unit === "kg" ? m.kg : m.donations);
  const max = Math.max(1, ...months.map(value));
  const peak = months.reduce((best, m) => (value(m) > value(best) ? m : best), months[0]);
  const format = (v) => (unit === "kg" ? `${v} kg` : `${v} donation${v === 1 ? "" : "s"}`);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" onClick={() => setAsTable((t) => !t)}>{asTable ? "Show chart" : "Show as table"}</Button>
      </Box>
      {asTable ? (
        <Table size="small" aria-label={`${unit} per month`}>
          <TableHead>
            <TableRow><TableCell>Month</TableCell><TableCell align="right">Donations</TableCell><TableCell align="right">Weight (kg)</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {months.map((m) => (
              <TableRow key={m.month}>
                <TableCell>{monthLabel(m.month, "long")}</TableCell>
                <TableCell align="right">{m.donations}</TableCell>
                <TableCell align="right">{m.kg}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Box sx={{ position: "relative", pt: 3 }}>
          {/* recessive gridline at the top value */}
          <Box sx={{ position: "absolute", left: 0, right: 0, top: 24, borderTop: "1px dashed", borderColor: "divider" }} />
          <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", top: 4, left: 0 }}>{format(max)}</Typography>
          <Box role="list" aria-label={`${unit} per month, last 12 months`} sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", alignItems: "end", height: 180, gap: "2px", borderBottom: 1, borderColor: "text.secondary" }}>
            {months.map((m) => {
              const v = value(m);
              const active = hover === m.month;
              return (
                <Box
                  key={m.month}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${monthLabel(m.month, "long")}: ${format(v)}`}
                  onMouseEnter={() => setHover(m.month)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(m.month)}
                  onBlur={() => setHover(null)}
                  sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default", outline: "none", "&:focus-visible > .bar": { outline: "2px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}
                >
                  {m === peak && v > 0 && !hover && (
                    <Typography variant="caption" sx={{ position: "absolute", bottom: `calc(${(v / max) * 100}% + 4px)`, fontWeight: 700 }}>{v}</Typography>
                  )}
                  <Box
                    className="bar"
                    sx={{
                      width: "100%",
                      maxWidth: 24,
                      height: `${(v / max) * 100}%`,
                      minHeight: v > 0 ? 3 : 0,
                      bgcolor: active ? "primary.dark" : "primary.main",
                      borderRadius: "4px 4px 0 0",
                      transition: "background-color 120ms",
                    }}
                  />
                  {active && (
                    <Box sx={{ position: "absolute", bottom: `calc(${(v / max) * 100}% + 8px)`, zIndex: 1, bgcolor: "text.primary", color: "#fff", px: 1, py: 0.5, borderRadius: 1.5, whiteSpace: "nowrap", pointerEvents: "none" }}>
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>{monthLabel(m.month, "long")}</Typography>
                      <Typography variant="caption">{m.donations} donation{m.donations === 1 ? "" : "s"} · {m.kg} kg</Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "2px", mt: 0.5 }} aria-hidden="true">
            {months.map((m) => (
              <Typography key={m.month} variant="caption" color="text.secondary" sx={{ textAlign: "center", fontSize: { xs: 10, sm: 12 } }}>
                {monthLabel(m.month).slice(0, 3)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MonthlyBars;
