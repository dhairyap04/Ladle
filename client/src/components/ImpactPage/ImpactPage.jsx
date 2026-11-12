import { useEffect, useState } from "react";
import { Link as RouterLink, useHistory } from "react-router-dom";
import { Alert, Box, Button, Chip, Container, Link, Paper, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AppHeader from "../Shared/AppHeader";
import MonthlyBars from "./MonthlyBars";
import api, { errorMessage } from "../../api";
import useAuthUser from "../../useAuthUser";
import { FOOD_TYPES } from "../../food";

const Stat = ({ value, label, hint }) => (
  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4 }}>
    <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.8rem", sm: "2.2rem" }, color: "primary.dark", lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
    {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
  </Paper>
);

const ImpactPage = () => {
  const user = useAuthUser();
  const history = useHistory();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState("donations");

  useEffect(() => {
    if (user === null) history.replace("/auth?mode=login");
    if (!user) return;
    api.get("impact").then((res) => setData(res.data)).catch((err) => setError(errorMessage(err)));
  }, [user, history]);

  const isFoodbank = data && data.role === "foodbank";
  const fmt = (n) => n.toLocaleString();

  return (
    <>
      <AppHeader user={user} />
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "flex-end" }} sx={{ mb: 3 }}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>Your impact</Typography>
            <Typography color="text.secondary">
              {isFoodbank ? "Food your food bank has collected through Ladle." : "Food you've donated through Ladle that was picked up."}
            </Typography>
          </Box>
          {data && data.donations > 0 && (
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              href={`${import.meta.env.REACT_APP_HOST_URL}impact/donations.csv`}
            >
              Download records (CSV)
            </Button>
          )}
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && <Skeleton variant="rounded" height={300} sx={{ borderRadius: 4 }} />}

        {data && data.donations === 0 && (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
            <Typography variant="h6">No completed donations yet</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {isFoodbank
                ? "Once you claim food and mark it picked up, it's counted here."
                : "Once a food bank picks up food you've posted, it's counted here."}
            </Typography>
            <Button component={RouterLink} to="/main" variant="contained" sx={{ mt: 2 }}>
              {isFoodbank ? "Find food to pick up" : "Post surplus food"}
            </Button>
          </Paper>
        )}

        {data && data.donations > 0 && (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
              <Stat value={fmt(data.donations)} label={isFoodbank ? "Pickups completed" : "Donations picked up"} />
              <Stat value={`${fmt(data.totalKg)} kg`} label="Food rescued" hint={data.donationsWithoutWeight ? `${data.donationsWithoutWeight} without a weight` : undefined} />
              <Stat value={fmt(data.estimatedMeals)} label="Estimated meals" hint={`About ${data.kgPerMeal} kg per meal`} />
              <Stat value={fmt(data.partnerCount)} label={isFoodbank ? "Restaurants" : "Food banks"} hint="you've worked with" />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 1fr)" }, gap: 3, mt: 3 }}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Typography component="h2" variant="h6">Last 12 months</Typography>
                  <ToggleButtonGroup size="small" exclusive value={unit} onChange={(e, v) => v && setUnit(v)} aria-label="Measure">
                    <ToggleButton value="donations">Donations</ToggleButton>
                    <ToggleButton value="kg">Kilograms</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <MonthlyBars months={data.months} unit={unit} />
              </Paper>

              <Stack spacing={3}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                  <Typography component="h2" variant="h6">{isFoodbank ? "Top restaurants" : "Top food banks"}</Typography>
                  <Stack component="ol" spacing={1} sx={{ pl: 2.5, mt: 1.5, mb: 0 }}>
                    {data.topPartners.map((p) => (
                      <Typography component="li" key={p.name}>
                        <strong>{p.name}</strong> <Typography component="span" color="text.secondary">· {p.donations}</Typography>
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                  <Typography component="h2" variant="h6">Food types</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                    {Object.entries(data.foodTypes).sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                      <Chip key={type} label={`${FOOD_TYPES[type] || type} · ${n}`} variant="outlined" />
                    ))}
                    {Object.keys(data.foodTypes).length === 0 && <Typography color="text.secondary">Not recorded yet.</Typography>}
                  </Box>
                </Paper>
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Weights are the restaurant&apos;s estimates. Meals are estimated with Feeding America&apos;s conversion of about 1.2 lb ({data.kgPerMeal} kg) of food per meal.
              A donation record for each pickup is available from the <Link component={RouterLink} to="/main">posting page</Link>.
            </Typography>
          </>
        )}
      </Container>
    </>
  );
};

export default ImpactPage;
