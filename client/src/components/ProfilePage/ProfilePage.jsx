// main imports
import { Component } from 'react'
import { Link } from 'react-router-dom';

// mui imports
import { Alert, Button, TextField } from '@mui/material';

// css imports
import "../../global.css";
import "./ProfilePage.css";
import "../MainPage/Components/CreatePosting.css";

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
        this.setState({ values, saved: values, isFoodbank: user.isFoodbank, loading: false });
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
    const { values, loading, saving, error, isFoodbank } = this.state;
    const field = (name, label, extra = {}) => (
      <TextField
        value={values[name]}
        onChange={this.handleChange(name)}
        className="textfield-data"
        fullWidth
        size="large"
        label={label}
        disabled={loading}
        {...extra}
      />
    );

    return (
      <div className='container flex-column center-center' >
        <div className="flex-row start-center">
          <Link to="/main">
            <img src='/images/logo.png' alt="MealDrop home" width="90px"></img>
          </Link>
          <div className="flex-column center-center" style={{ marginLeft: "25px" }}>
            <div className='profile-header'>
              Profile
            </div>
            <div className='profile-subheader'>
              Update your Personal Info
            </div>
          </div>
        </div>
        {error && <Alert severity="error" sx={{ mt: 2, width: "100%", boxSizing: "border-box" }}>{error}</Alert>}
        <div className='flex-row' style={{ justifyContent: "space-between", width: "100%" }}>
          <div className='create-posting-left ' style={{ marginTop: "20px" }}>
            {field("name", "Name", { required: true })}
            {field("phoneNumber", "Phone Number", { type: "tel" })}
            {isFoodbank && field("charitableTaxNum", "Charitable Registration #")}
          </div>
          <div className='create-posting-left' style={{ marginTop: "20px" }}>
            {field("address", "Address")}
            {field("website", "Website", { type: "url" })}
            <div className='flex-row' style={{ justifyContent: "space-between" }}>
              {field("openTime", "Opening Time", { type: "time", style: { width: "49%" }, InputLabelProps: { shrink: true } })}
              {field("closeTime", "Closing Time", { type: "time", style: { width: "49%" }, InputLabelProps: { shrink: true } })}
            </div>
          </div>
        </div>
        <Button onClick={this.updateProfile} disabled={loading || saving} style={{ marginTop: "20px" }} variant="contained">
          {saving ? "Saving…" : "Update Profile"}
        </Button>
      </div >
    )
  }
}

export default ProfilePage;
