import { Link as RouterLink } from "react-router-dom";
import { Box, CardActionArea, Paper, Stack, Typography } from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import StatusChip from "../../Shared/StatusChip";
import { formatPickupWindow } from "../../../time";

// A posting in a list. `showStatus` adds its status chip (used for "Your postings").
const PostingTile = ({ postingData: posting, showStatus }) => {
  const status = posting.status || "open";
  const inactive = status === "expired" || status === "cancelled";
  return (
    <Paper variant="outlined" sx={{ borderRadius: 4, overflow: "hidden", opacity: inactive ? 0.75 : 1, "&:hover": { borderColor: "primary.main" } }}>
      <CardActionArea component={RouterLink} to={`/view_post/${posting._id}`} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 52,
              height: 52,
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
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
              <Typography component="h3" sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
                {posting.fromRestaurantName}
              </Typography>
              {showStatus && <StatusChip status={status} />}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, color: "primary.dark" }}>
              <ScheduleRoundedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatPickupWindow(posting)}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
              <PlaceRoundedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" noWrap>{posting.fromRestaurantAddress}</Typography>
            </Stack>
            {posting.notes && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                {posting.notes}
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
