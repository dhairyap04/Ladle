// Main imports
import { useEffect, useState } from 'react'
import { Link, useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import LunchDiningRoundedIcon from '@mui/icons-material/LunchDiningRounded';
import AcUnitRoundedIcon from '@mui/icons-material/AcUnitRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

// Root imports
import api, { errorMessage } from '../../api';
import { formatPickupDate, formatPickupTime, formatPickupWindow } from '../../time';
import AppHeader from '../Shared/AppHeader';
import { mapPoints } from '../../mapPoints';
import MessagesPanel from './MessagesPanel';
import StatusChip from '../Shared/StatusChip';
import { FOOD_TYPES, STORAGE, allergenSummary, photoUrl } from '../../food';
import SimpleMap from '../MainPage/Components/GoogleMap';
import PostingModal from '../MainPage/Components/CreatePosting';

const STATUS_TEXT = {
  claimed: "A food bank has already claimed this posting.",
  picked_up: "This food has been picked up.",
  expired: "The pickup window for this posting has passed.",
  cancelled: "The restaurant has withdrawn this posting.",
};

const CONFIRM_TEXT = {
  claim: { title: "Claim this pickup?", button: "Yes, claim it" },
  cancel: {
    title: "Withdraw this posting?",
    body: "Food banks will no longer see this posting. This can't be undone.",
    button: "Yes, withdraw it",
  },
  pickedUp: {
    title: "Mark as picked up?",
    body: "Confirm that your food bank has collected this food.",
    button: "Yes, we picked it up",
  },
};

const DetailRow = ({ icon: Icon, label, children }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon fontSize="small" />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere", whiteSpace: "pre-line" }}>{children}</Typography>
    </Box>
  </Stack>
);

const ViewPost = () => {
  const { id } = useParams();
  const history = useHistory();

  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState(undefined);
  const [latlng, setLatlng] = useState([]);
  const [confirming, setConfirming] = useState(null); // "claim" | "cancel" | "pickedUp" | null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.get(`posting/one/${id}`)
      .then(res => {
        setPost(res.data);
        mapPoints([res.data]).then(setLatlng);
      })
      .catch(err => setLoadError(errorMessage(err, "Couldn't load this posting.")));

    api.get("user/isAuth")
      .then(res => setUser(res.data))
      .catch(() => setUser(null));
  }, [id]);

  const runAction = async () => {
    const action = confirming;
    setBusy(true);
    setActionError("");
    try {
      if (action === "claim") {
        await api.post(`posting/${id}/claim`);
        history.push("/confirmed");
      } else if (action === "pickedUp") {
        const res = await api.post(`posting/${id}/picked-up`);
        setPost(res.data);
        setBusy(false);
        setConfirming(null);
      } else {
        await api.post(`posting/${id}/cancel`);
        history.push("/main");
      }
    } catch (err) {
      setActionError(errorMessage(err));
      setBusy(false);
      setConfirming(null);
    }
  };

  const isOpen = post && (!post.status || post.status === "open");
  const isOwner = post && user && post.donorId && post.donorId === user.id;
  const isClaimer = post && user && post.claimedBy && post.claimedBy === user.id;

  const renderActions = () => {
    if (isClaimer && post.status === "claimed") {
      return (
        <Stack spacing={1.5}>
          <Alert severity="success">Your food bank claimed this pickup. Collect it during the pickup window.</Alert>
          <Button variant='contained' size="large" onClick={() => setConfirming("pickedUp")}>
            Mark as picked up
          </Button>
        </Stack>
      );
    }
    if (isOwner && post.status === "claimed") {
      return <Alert severity="success">Claimed by {post.claimedByName}.</Alert>;
    }
    if (post.status === "picked_up" && (isOwner || isClaimer)) {
      return (
        <Stack spacing={1.5}>
          <Alert severity="success">{STATUS_TEXT.picked_up}</Alert>
          <Button component={Link} to={`/receipt/${post._id}`} variant="outlined">View donation record</Button>
        </Stack>
      );
    }
    if (!isOpen) {
      return <Alert severity="info">{STATUS_TEXT[post.status]}</Alert>;
    }
    if (isOwner) {
      return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button variant='contained' size="large" onClick={() => setEditing(true)}>
            Edit posting
          </Button>
          <Button variant='outlined' size="large" color="error" onClick={() => setConfirming("cancel")}>
            Withdraw posting
          </Button>
        </Stack>
      );
    }
    if (user && user.isFoodbank) {
      return (
        <Button variant='contained' size="large" fullWidth onClick={() => setConfirming("claim")}>
          I can pick this up
        </Button>
      );
    }
    if (user === undefined) return null;
    if (!user) {
      return (
        <Alert severity="info">
          <Link to="/auth">Log in with a food bank account</Link> to claim this pickup.
        </Alert>
      );
    }
    return <Alert severity="info">Only food bank accounts can claim pickups.</Alert>;
  };

  const status = (post && post.status) || "open";
  const STEPS = ["Posted", "Claimed", "Picked up"];
  const activeStep = { open: 1, claimed: 2, picked_up: 3 }[status];

  let PostInfo;
  if (loadError) {
    PostInfo = <Alert severity="error">{loadError}</Alert>;
  } else if (!post) {
    PostInfo = <Skeleton variant="rounded" height={420} sx={{ borderRadius: 5 }} />;
  } else {
    PostInfo = (
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
        {post.hasPhoto && (
          <Box
            component="img"
            src={photoUrl(post)}
            alt={`Food from ${post.fromRestaurantName}`}
            sx={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 3, mb: 2.5 }}
          />
        )}
        <StatusChip status={status} />
        <Typography component="h1" variant="h4" sx={{ mt: 1.5, color: "primary.dark" }}>{post.fromRestaurantName}</Typography>

        {activeStep && (
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 3, "& .MuiStepIcon-root.Mui-completed": { color: "primary.main" } }}>
            {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
        )}

        <Stack spacing={2} sx={{ mt: 3 }}>
          <DetailRow icon={ScheduleRoundedIcon} label="Pickup window">
            {post.pickupDate ? formatPickupWindow(post) : `Posted ${new Date(post.createdAt).toDateString()}`}
          </DetailRow>
          <DetailRow icon={PlaceRoundedIcon} label="Pickup address">{post.fromRestaurantAddress}</DetailRow>
          <DetailRow icon={LunchDiningRoundedIcon} label="Food">
            {[
              (post.foodTypes || []).map((t) => FOOD_TYPES[t]).join(", ") || "Not specified",
              post.quantity,
              post.estimatedWeightKg ? `about ${post.estimatedWeightKg} kg` : "",
            ].filter(Boolean).join(" · ")}
          </DetailRow>
          <DetailRow icon={AcUnitRoundedIcon} label="Storage">
            {STORAGE[post.storage || "ambient"].label}
            {post.preparedAt ? ` · prepared ${new Date(post.preparedAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}
          </DetailRow>
          <DetailRow icon={WarningAmberRoundedIcon} label="Allergens">{allergenSummary(post.allergens)}</DetailRow>
          {post.notes && <DetailRow icon={NotesRoundedIcon} label="Notes">{post.notes}</DetailRow>}
        </Stack>

        <Divider sx={{ my: 3 }} />
        {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
        {renderActions()}
      </Paper>
    );
  }

  return (
    <>
      <AppHeader user={user} />
      <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        <Button component={Link} to="/main" startIcon={<ArrowBackRoundedIcon />} color="inherit" sx={{ mb: 2, ml: -1 }}>
          Back to pickups
        </Button>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.1fr) minmax(0, 1fr)" }, gap: { xs: 3, md: 4 }, alignItems: "start" }}>
          {PostInfo}
          <Stack spacing={3}>
            {post && user && (isOwner || user.isFoodbank) && (
              <MessagesPanel postingId={post._id} user={user} isOwner={Boolean(isOwner)} />
            )}
            <Paper variant="outlined" sx={{ height: { xs: 260, md: 360 }, borderRadius: 5, overflow: "hidden" }}>
              <SimpleMap latlng={latlng} />
            </Paper>
          </Stack>
        </Box>
      </Container>

      {editing && post && (
        <PostingModal
          posting={post}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setPost(updated);
            setEditing(false);
            mapPoints([updated]).then(setLatlng);
          }}
        />
      )}

      <Dialog open={confirming !== null} onClose={() => !busy && setConfirming(null)}>
        <DialogTitle>{confirming && CONFIRM_TEXT[confirming].title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirming === "claim" && post
              ? `This reserves the food for your food bank and removes it from the list for everyone else. Please pick it up${post.pickupDate ? ` on ${formatPickupDate(post.pickupDate)}` : ""} between ${formatPickupTime(post.pickupTimeBegin)} and ${formatPickupTime(post.pickupTimeEnd)}.`
              : confirming && CONFIRM_TEXT[confirming].body}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(null)} disabled={busy}>Go back</Button>
          <Button onClick={runAction} disabled={busy} variant="contained" color={confirming === "cancel" ? "error" : "primary"}>
            {confirming && CONFIRM_TEXT[confirming].button}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ViewPost
