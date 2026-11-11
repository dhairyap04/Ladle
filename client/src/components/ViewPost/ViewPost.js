// Main imports
import React, { useEffect, useState } from 'react'
import { Link, useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import Geocode from "react-geocode";

// Root imports
import api, { errorMessage } from '../../api';
import { formatPickupTime } from '../../time';
import SimpleMap from '../MainPage/Components/GoogleMap';

// css
import "../../global.css";
import "./ViewPost.css";
import "../MainPage/MainPage.css";
import "../ProfilePage/ProfilePage.css";

const LinkTheme = { textDecoration: "None", color: "black" };

const STATUS_TEXT = {
  claimed: "A food bank has already claimed this posting.",
  cancelled: "The restaurant has withdrawn this posting.",
};

const ViewPost = () => {
  const { id } = useParams();
  const history = useHistory();

  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState(null);
  const [latlng, setLatlng] = useState([]);
  const [confirming, setConfirming] = useState(null); // "claim" | "cancel" | null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    api.get(`posting/one/${id}`)
      .then(res => {
        setPost(res.data);
        Geocode.fromAddress(res.data.fromRestaurantAddress)
          .then((geo) => {
            const { lat, lng } = geo.results[0].geometry.location;
            setLatlng([{ lat, lng, name: res.data.fromRestaurantName }]);
          })
          .catch(() => {});
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

  const renderActions = () => {
    if (!isOpen) {
      return <Alert severity="info" sx={{ mt: 1 }}>{STATUS_TEXT[post.status]}</Alert>;
    }
    if (isOwner) {
      return (
        <Button variant='outlined' color="error" style={{ marginTop: "10px" }} onClick={() => setConfirming("cancel")}>
          Withdraw this posting
        </Button>
      );
    }
    if (user && user.isFoodbank) {
      return (
        <>
          <Button variant='contained' style={{ marginTop: "10px" }} onClick={() => setConfirming("claim")}>I can pick this up</Button>
          <Button variant='outlined' style={{ marginTop: "10px" }} onClick={() => alert("Coming soon!")}>Schedule Uber Delivery (Beta)</Button>
          <Button variant='outlined' style={{ marginTop: "10px" }} onClick={() => alert("Coming soon!")}>Use one of our drivers (Beta)</Button>
        </>
      );
    }
    if (!user) {
      return (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Link to="/auth">Log in with a food bank account</Link> to claim this pickup.
        </Alert>
      );
    }
    return <Alert severity="info" sx={{ mt: 1 }}>Only food bank accounts can claim pickups.</Alert>;
  };

  let PostInfo;
  if (loadError) {
    PostInfo = <Alert severity="error">{loadError}</Alert>;
  } else if (!post) {
    PostInfo = <h3>Loading...</h3>;
  } else {
    PostInfo = (
      <div id="info">
        <h1 className="restaurant-name">{post.fromRestaurantName}</h1>
        <h3 className="restaurant-address">{post.fromRestaurantAddress}</h3>
        <p className="pickup"><b>Posted:</b> {new Date(post.createdAt).toDateString()}</p>
        <p className="pickup"><b>Pickup Time:</b> {formatPickupTime(post.pickupTimeBegin)} - {formatPickupTime(post.pickupTimeEnd)}</p>
        <hr style={{ color: "black", width: "100%" }} />
        <p><b>Notes:</b> {post.notes ? post.notes : "None"}</p>
        <hr style={{ color: "black", width: "100%" }} />
        {actionError && <Alert severity="error" sx={{ mt: 1 }}>{actionError}</Alert>}
        {renderActions()}
      </div>
    );
  }

  return (
    <>
      <div className='container flex-column center-center' style={{ width: "80%" }} >
        <div className="flex-row start-center" style={{ marginBottom: "20px", justifyContent: "space-between", width: "100%" }}>
          <div className='flex-row start-center'>
            <Link to="/main">
              <img src='/images/logo.png' alt="MealDrop home" width="90px"></img>
            </Link>
            <div className="flex-column" style={{ marginLeft: "25px" }}>
              <div className="profile-header">
                View Posting
              </div>
              <div className="profile-subheader">
                {post && post.fromRestaurantName}
              </div>
            </div>
          </div>
          <div className='flex-column start-center'>
            <Link to="/main" style={LinkTheme}>
              <Button variant='outlined' style={{ color: "black", borderColor:"black", height: "50px", width: "150px", textDecoration: "none" }}>Back</Button>
            </Link>
          </div>
        </div>
        <div id="viewpost-page" style={{ justifyContent: 'space-between' }} className='flex-row '>
          <div style={{ width: '49%', height: "100%" }}>
            {PostInfo}
          </div>
          <div className="maps-row" style={{ padding: "0" }}>
            <SimpleMap latlng={latlng} />
          </div>
        </div>
      </div>

      <Dialog open={confirming !== null} onClose={() => !busy && setConfirming(null)}>
        <DialogTitle>
          {confirming === "claim" ? "Claim this pickup?" : "Withdraw this posting?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirming === "claim"
              ? `This reserves the food for your food bank and removes it from the list for everyone else. Please pick it up between ${post ? formatPickupTime(post.pickupTimeBegin) : ""} and ${post ? formatPickupTime(post.pickupTimeEnd) : ""}.`
              : "Food banks will no longer see this posting. This can't be undone."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)} disabled={busy}>Go back</Button>
          <Button onClick={runAction} disabled={busy} variant="contained" color={confirming === "cancel" ? "error" : "primary"}>
            {confirming === "claim" ? "Yes, claim it" : "Yes, withdraw it"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ViewPost
