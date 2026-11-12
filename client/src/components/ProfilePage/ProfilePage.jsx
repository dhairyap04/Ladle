// main imports
import { Component } from 'react'

// mui imports
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded';

import AppHeader from '../Shared/AppHeader';

// Root imports
import api, { errorMessage } from '../../api';

const FIELDS = ["name", "phoneNumber", "charitableTaxNum", "address", "website", "openTime", "closeTime"];

// openHours is stored as "HH:MM-HH:MM".
const splitHours = (openHours) => {
  const [openTime = "", closeTime = ""] = (openHours || "").split("-");
  return { openTime: openTime.trim(), closeTime: closeTime.trim() };
};

class ProfilePage extends Component {
  constructor(props) {
    super(props);
    const empty = Object.fromEntries(FIELDS.map((field) => [field, ""]));
    this.state = {
      values: empty,
      saved: empty,
      isFoodbank: false,
      user: undefined, // for the header
      loading: true,
      saving: false,
      error: "",
    };
  }

  componentDidMount() {
    api.get("user/info")
      .then((res) => {
        const user = res.data.user;
        const values = {
          name: user.name,
          phoneNumber: user.phoneNumber,
          charitableTaxNum: user.charitableTaxNum,
          address: user.address,
          website: user.website,
          ...splitHours(user.openHours),
        };
        this.setState({ values, saved: values, isFoodbank: user.isFoodbank, user, loading: false });
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) {
          this.props.history.replace("/auth");
        } else {
          this.setState({ loading: false, error: errorMessage(err, "Couldn't load your profile.") });
        }
      });
  }

  handleChange = (field) => (e) => {
    const value = e.target.value;
    this.setState((state) => ({ values: { ...state.values, [field]: value } }));
  }

  updateProfile = async () => {
    const { values, saved } = this.state;
    if (!values.name.trim()) {
      this.setState({ error: "Name cannot be empty." });
      return;
    }

    // Send only the fields that changed, so untouched fields are never overwritten.
    const changes = {};
    ["name", "phoneNumber", "charitableTaxNum", "address", "website"].forEach((field) => {
      if (values[field] !== saved[field]) changes[field] = values[field];
    });
    if (values.openTime !== saved.openTime || values.closeTime !== saved.closeTime) {
      changes.openHours = values.openTime || values.closeTime ? `${values.openTime}-${values.closeTime}` : "";
    }

    if (Object.keys(changes).length === 0) {
      this.props.history.push("/main");
      return;
    }

    this.setState({ saving: true, error: "" });
    try {
      await api.post("user/update", changes);
      this.props.history.push("/main");
    } catch (err) {
      this.setState({ saving: false, error: errorMessage(err) });
    }
  }

  render() {
    const { values, loading, saving, error, isFoodbank, user } = this.state;
    const field = (name, label, extra = {}) => (
      <TextField
        value={values[name] || ""}
        onChange={this.handleChange(name)}
        fullWidth
        label={label}
        disabled={loading}
        {...extra}
      />
    );
    const RoleIcon = isFoodbank ? VolunteerActivismRoundedIcon : StorefrontRoundedIcon;

    return (
      <>
        <AppHeader user={user} />
        <Container component="main" maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
              <RoleIcon />
            </Box>
            <Box>
              <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>Your profile</Typography>
              <Typography color="text.secondary">
                {loading ? "Loading…" : isFoodbank ? "Food bank account" : "Restaurant account"}
              </Typography>
            </Box>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
            <Typography component="h2" variant="h6">Organization</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
              {field("name", "Name", { required: true })}
              {field("phoneNumber", "Phone number", { type: "tel", autoComplete: "tel" })}
              {field("website", "Website", { type: "url", autoComplete: "url" })}
              {isFoodbank && field("charitableTaxNum", "Charitable registration #")}
            </Box>

            <Typography component="h2" variant="h6" sx={{ mt: 4 }}>Location and hours</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
              {field("address", "Address", { autoComplete: "street-address", sx: { gridColumn: { sm: "1 / -1" } } })}
              {field("openTime", "Opens at", { type: "time", InputLabelProps: { shrink: true } })}
              {field("closeTime", "Closes at", { type: "time", InputLabelProps: { shrink: true } })}
            </Box>

            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 4 }}>
              <Button onClick={() => this.props.history.push("/main")} color="inherit">Cancel</Button>
              <Button onClick={this.updateProfile} disabled={loading || saving} variant="contained" size="large">
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </Stack>
          </Paper>
        </Container>
      </>
    )
  }
}

export default ProfilePage;
