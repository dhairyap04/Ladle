import { Link as RouterLink } from "react-router-dom";
import { Box, CardActionArea, Chip, Paper, Stack, Typography } from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import StatusChip from "../../Shared/StatusChip";
import { formatPickupWindow } from "../../../time";
import { FIT_PROBLEMS, FOOD_TYPES, STORAGE, photoUrl } from "../../../food";

// A posting in a list. `showStatus` adds its status chip (used for "Your postings").
const PostingTile = ({ postingData: posting, showStatus }) => {
  const status = posting.status || "open";
  const inactive = status === "expired" || status === "cancelled";
  // e.g. "Bread & bakery, Dairy & eggs · 3 trays · ~4 kg · Refrigerated"
  const summary = [
    (posting.foodTypes || []).map((t) => FOOD_TYPES[t]).join(", "),
    posting.quantity,
    posting.estimatedWeightKg ? `~${posting.estimatedWeightKg} kg` : "",
    posting.storage && posting.storage !== "ambient" ? STORAGE[posting.storage].short : "",
  ].filter(Boolean).join(" · ") || posting.notes;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 4, overflow: "hidden", opacity: inactive ? 0.75 : 1, "&:hover": { borderColor: "primary.main" } }}>
      <CardActionArea component={RouterLink} to={`/view_post/${posting._id}`} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {posting.hasPhoto ? (
            <Box
              component="img"
              src={photoUrl(posting)}
              alt=""
              loading="lazy"
              sx={{ width: 72, height: 72, borderRadius: 3, objectFit: "cover", flexShrink: 0, bgcolor: "#FDEEDC" }}
            />
          ) : (
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 3,
                bgcolor: "#FDEEDC",
                color: "#B85A08",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <StorefrontRoundedIcon />
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
              <Typography component="h3" sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
                {posting.fromRestaurantName}
              </Typography>
              {showStatus && <StatusChip status={status} />}
              {posting.fitProblems && (
                posting.fitProblems.length === 0
                  ? <Chip size="small" label="Good fit" sx={{ bgcolor: "primary.light", color: "primary.dark" }} />
                  : <Chip size="small" label={FIT_PROBLEMS[posting.fitProblems[0]]} sx={{ bgcolor: "#FFF1D6", color: "#7A4700" }} />
              )}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, color: "primary.dark" }}>
              <ScheduleRoundedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatPickupWindow(posting)}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
              <PlaceRoundedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" noWrap>
                {posting.distanceKm !== undefined && <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{posting.distanceKm} km · </Box>}
                {posting.fromRestaurantAddress}
              </Typography>
            </Stack>
            {summary && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                {summary}
              </Typography>
            )}
          </Box>
          <ChevronRightRoundedIcon sx={{ color: "text.secondary" }} />
        </Stack>
      </CardActionArea>
    </Paper>
  );
};

export default PostingTile;
