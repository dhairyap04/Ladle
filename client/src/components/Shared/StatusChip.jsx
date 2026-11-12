import { Chip } from "@mui/material";
import { STATUS_LABELS } from "../../time";

const STATUS_COLORS = {
  open: { bgcolor: "#E6F2EC", color: "#0F4A32" },
  claimed: { bgcolor: "#FFF1D6", color: "#7A4700" },
  picked_up: { bgcolor: "#0F4A32", color: "#FFFFFF" },
  expired: { bgcolor: "#EEECE8", color: "#4F5753" },
  cancelled: { bgcolor: "#EEECE8", color: "#4F5753" },
};

const StatusChip = ({ status = "open", size = "small", sx }) => (
  <Chip label={STATUS_LABELS[status]} size={size} sx={{ ...STATUS_COLORS[status], ...sx }} />
);

export default StatusChip;
