// Main imports
import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { Link, useHistory, useParams } from "react-router-dom";
import { Button } from '@mui/material';
import Geocode from "react-geocode";

// Root imports
import { tConvert } from '../MainPage/Components/PostingTile';
import SimpleMap from '../MainPage/Components/GoogleMap';

// css
import "../../global.css";
import "./ViewPost.css";
import "../MainPage/MainPage.css";
import "../ProfilePage/ProfilePage.css";

const LinkTheme = { textDecoration: "None", color: "black" };

const ViewPost = () => {
  const URL = process.env.REACT_APP_HOST_URL;
  const { id } = useParams();

  const [Post, setPost] = useState({});
  const history = useHistory();
  const [latlng, setLatlng] = useState([]);
  const [rerender, setRerender] = useState(false);

  useEffect(() => {
    axios.get(`${URL}posting/one/${id}`,)
      .then(res => {
        setPost(res.data);
        getLatLng({ "address": res.data.fromRestaurantAddress, "name": res.data.fromRestaurantName });
      })
      .catch(err => {
        alert(err.response);
      })
  }, [])

  const handlePickUp = () => {
    axios.post(`${URL}posting/delete`, { id: id, })
      .then(res => {
        history.push("/confirmed");
      })
      .catch(e => {
        alert(e.response);
      })
  }

  const getLatLng = (addressObject) => {
    var latlng = [];
    Geocode.fromAddress(addressObject.address)
      .then((res) => {
        var indLatlng = res.results[0].geometry.location;
        // console.log(res.results[0].geometry.location);
        latlng.push({ "lat": indLatlng.lat, "lng": indLatlng.lng, "name": addressObject.name });
        setLatlng(latlng);
        setRerender(!rerender);
        console.log(latlng);
      })
  }

  const PostInfo = Object.keys(Post).length ? (<div id="info">
    <h1 className="restaurant-name">{Post.fromRestaurantName}</h1>
    <h3 className="restaurant-address">{Post.fromRestaurantAddress}</h3>
    <p className="pickup"><b>Pickup Date:</b> {new Date(Post.updatedAt).toDateString()}</p>
    <p className="pickup"><b>Pickup Time:</b> {tConvert(Post.pickupTimeBegin)} - {tConvert(Post.pickupTimeEnd)}</p>
    <hr style={{ color: "black", width: "100%" }} />
    <p><b>Notes:</b> {Post.notes == "" ? "None" : Post.notes}</p>
    <hr style={{ color: "black", width: "100%" }} />
    <Button variant='contained' style={{ marginTop: "10px" }} onClick={e => handlePickUp()} >I can pick this up</Button>
    <Button variant='contained' style={{ marginTop: "10px", backgroundColor: "black" }} onClick={e => alert("Coming soon!")}>Schedule Uber Delivery (Beta)</Button>
    <Button variant='contained' style={{ marginTop: "10px" }} onClick={e => alert("Coming soon!")}>Use one of our drivers (Beta)</Button>
  </div>) : (
    <h3>Loading...</h3>);

  return (
    <>
      <div className='container flex-column center-center' style={{ width: "80%" }} >
        <div className="flex-row start-center" style={{ marginBottom: "20px", justifyContent: "space-between" }}>
          <div className='flex-row start-center'>
            <Link to="/main">
              <img src='../images/logo.png' width="90px"></img>
            </Link>
            <div className="flex-column" style={{ marginLeft: "25px" }}>
              <div className="profile-header">
                View Posting
              </div>
              <div className="profile-subheader">
                {Post.fromRestaurantName}
              </div>
            </div>
          </div>
          <div className='flew-column start-center'>
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
    </>
  )
}

export default ViewPost
