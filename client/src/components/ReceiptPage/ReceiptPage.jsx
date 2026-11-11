import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Alert, Box, Button, Container, Divider, Paper, Stack, Typography } from "@mui/material";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import AppHeader from "../Shared/AppHeader";
import Logo from "../Shared/Logo";
import api, { errorMessage } from "../../api";
import useAuthUser from "../../useAuthUser";
import { FOOD_TYPES, STORAGE, allergenSummary } from "../../food";

const Party = ({ title, party, extra }) => (
  <Box>
    <Typography variant="overline" color="text.secondary">{title}</Typography>
    <Typography sx={{ fontWeight: 800 }}>{party.name}</Typography>
    {party.address && <Typography variant="body2">{party.address}</Typography>}
    {party.phoneNumber && <Typography variant="body2">{party.phoneNumber}</Typography>}
    {party.email && <Typography variant="body2">{party.email}</Typography>}
    {extra}
  </Box>
);

const Row = ({ label, children }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "200px 1fr" }, gap: { sm: 2 }, py: 1 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{children}</Typography>
  </Box>
);

// A printable record of one completed donation.
const ReceiptPage = () => {
  const { id } = useParams();
  const user = useAuthUser();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`posting/${id}/receipt`).then((res) => setReceipt(res.data)).catch((err) => setError(errorMessage(err)));
  }, [id]);

  return (
    <>
      <Box sx={{ "@media print": { display: "none" } }}><AppHeader user={user} /></Box>
      <Container component="main" maxWidth="md" sx={{ py: { xs: 3, md: 5 }, "@media print": { py: 0 } }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2, "@media print": { display: "none" } }}>
          <Button component={RouterLink} to={`/view_post/${id}`} startIcon={<ArrowBackRoundedIcon />} color="inherit" sx={{ ml: -1 }}>
            Back to posting
          </Button>
          {receipt && <Button variant="contained" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>Print or save as PDF</Button>}
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {receipt && (
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4, "@media print": { border: "none", p: 0 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ flexWrap: "wrap", gap: 2 }}>
              <Logo to={null} size={40} />
              <Box sx={{ textAlign: { sm: "right" } }}>
                <Typography component="h1" variant="h5">Food donation record</Typography>
                <Typography variant="body2" color="text.secondary">No. {receipt.receiptNumber}</Typography>
              </Box>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3, mt: 4 }}>
              <Party title="Donated by" party={receipt.donor} />
              <Party
                title="Received by"
                party={receipt.recipient}
                extra={
                  <>
                    {receipt.recipient.charitableTaxNum && (
                      <Typography variant="body2">Charitable registration #: {receipt.recipient.charitableTaxNum}</Typography>
                    )}
                    {receipt.recipient.verified && (
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "primary.main", mt: 0.5 }}>
                        <VerifiedRoundedIcon fontSize="small" />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Verified by Ladle</Typography>
                      </Stack>
                    )}
                  </>
                }
              />
            </Box>

            <Divider sx={{ my: 3 }} />
            <Row label="Picked up">{new Date(receipt.pickedUpAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</Row>
            <Row label="Pickup window">{receipt.pickupWindow}</Row>
            <Row label="Pickup address">{receipt.pickupAddress}</Row>
            <Row label="Food">{receipt.food.foodTypes.map((t) => FOOD_TYPES[t]).join(", ") || "Not specified"}</Row>
            {receipt.food.quantity && <Row label="Quantity">{receipt.food.quantity}</Row>}
            <Row label="Estimated weight">{receipt.food.estimatedWeightKg ? `${receipt.food.estimatedWeightKg} kg (donor's estimate)` : "Not recorded"}</Row>
            <Row label="Storage">{STORAGE[receipt.food.storage].label}</Row>
            <Row label="Allergens">{allergenSummary(receipt.food.allergens)}</Row>
            {receipt.food.notes && <Row label="Notes">{receipt.food.notes}</Row>}
            <Divider sx={{ my: 3 }} />

            <Typography variant="body2" color="text.secondary">
              This is a record of a food donation arranged through Ladle, for the records of the donor and the recipient.
              It is not an official donation receipt for income tax purposes. In Canada, official receipts can only be issued by a
              registered charity or other qualified donee; contact the recipient organization about receipting.
            </Typography>
          </Paper>
        )}
      </Container>
    </>
  );
};

export default ReceiptPage;
