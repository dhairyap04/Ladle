// main imports
import { React, Component } from 'react'
import axios from "axios";
import { Link } from 'react-router-dom';

// css imports
import "../../global.css";
import "./MainPage.css";


// Root imports
import Button from '@mui/material/Button';
import PostingTile from './Components/PostingTile';
import Geocode from "react-geocode";
import SimpleMap from './Components/GoogleMap';
import CreatePostingModal from './Components/CreatePosting';

// set Google Maps Geocoding API for purposes of quota management. Its optional but recommended.
Geocode.setApiKey(process.env.REACT_APP_GCP_KEY);
Geocode.setLanguage("en");
Geocode.setRegion("es");

const LinkTheme = {textDecoration: "None", color: "black"};

class MainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      postings: [],
      latlng: [],
      authorized: false,
      authObject: {},
      toggleModal: false,
    };
  }

  changeValue = (value, param) => {
    this.setState({ [value]: param });
    this.forceUpdate();
  }

  componentDidMount() {
    this.getPostings();
    var authURL = `${process.env.REACT_APP_HOST_URL}user/isAuth`;
    axios.get(authURL, { withCredentials: true })
      .then(res => {
        this.setState({ authorized: true, authObject: res.data });
      }).catch(err => {
        this.setState({ authorized: false });
      })
  }

  getPostings = async () => {
    const getPostingsURL = `${process.env.REACT_APP_HOST_URL}posting/all`;
    await axios.get(getPostingsURL)
      .then(res => {
        this.setState({ postings: res.data }, () => this.getLatLng());
      }).catch(err => {
        console.log("ERROR: Posting retrieval failed ", err);
      });
  }

  getLatLng = () => {
    var latlng = [];
    this.state.postings.forEach(async (posting) => {
      Geocode.fromAddress(posting.fromRestaurantAddress)
        .then((res) => {
          var indLatlng = res.results[0].geometry.location;
          // console.log(res.results[0].geometry.location);
          latlng.push({ "lat": indLatlng.lat, "lng": indLatlng.lng, "name": posting.fromRestaurantName });
          this.forceUpdate();
        })
    })
    this.setState({ latlng: latlng });
  }

  render() {
    var postings = this.state.postings;
    var latlng = this.state.latlng;
    var auth = this.state.authorized;
    return (
      <>
        {this.state.toggleModal && (
          <CreatePostingModal changeValue={this.changeValue.bind(this)} />
        )}
        <div className='container flex-column center-center' >

          <div className="flex-row space-between welcome-banner">
            <div className='flex-row start-center'>
              <Link to="/main">
                <img src='images/logo.png' width="90px"></img>
              </Link>
              <div className="welcome">
                Welcome {!auth ? "Guest" : this.state.authObject.name}!
              </div>
            </div>
            <Link style={LinkTheme} to="/view_profile">
              <Button variant="outlined">
                Manage Personal Info
              </Button>
            </Link>
          </div>
          <div className='flex-row space-between start main-container'>
            {postings.length !== 0 && (
              <>
                <div className='postings-row'>
                  <Button variant="contained" sx={{ width: "100%", height: "45px" }} onClick={() => { this.setState({ toggleModal: true }) }} >Create a Posting</Button>
                  {
                    postings.map((posting, index) => {
                      return <PostingTile key={index} postingData={posting} />
                    })
                  }
                </div>
                {latlng.length !== 0 && (
                  <div className='maps-row'>
                    <SimpleMap latlng={this.state.latlng} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </>
    )
  }
}

export default MainPage;