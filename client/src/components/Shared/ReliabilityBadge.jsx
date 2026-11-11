import { Chip, Stack, Tooltip } from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";

// "96% on time · ★ 4.8 (12)" for a reliability summary from the API, or "New"
// when there isn't enough history yet. `noun` is what they commit to.
const ReliabilityBadge = ({ summary, noun = "pickups", showFlag = false }) => {
  if (!summary) return null;
  const { pickupRate, rating, ratingCount, completed, noShows, lateReleases, flagged } = summary;
  const detail = `${completed} completed, ${noShows} missed, ${lateReleases} cancelled late in the last 6 months`;
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
      <Tooltip title={detail}>
        <Chip
          size="small"
          variant="outlined"
          label={pickupRate === null ? `New · ${completed} ${noun}` : `${Math.round(pickupRate * 100)}% of ${noun} completed`}
          sx={pickupRate !== null && pickupRate < 0.7 ? { borderColor: "#B26A00", color: "#7A4700" } : undefined}
        />
      </Tooltip>
      {ratingCount > 0 && (
        <Chip
          size="small"
          variant="outlined"
          icon={<StarRoundedIcon sx={{ color: "#B85A08 !important" }} />}
          label={`${rating.toFixed(1)} (${ratingCount})`}
          aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${ratingCount} ratings`}
        />
      )}
      {showFlag && flagged && (
        <Chip size="small" icon={<FlagRoundedIcon />} label="Needs review" sx={{ bgcolor: "#FDE7E7", color: "#8A1C1C" }} />
      )}
    </Stack>
  );
};

export default ReliabilityBadge;
