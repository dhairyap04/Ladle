// main imports
import { Component } from 'react'
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
import api from '../../api';

// set Google Maps Geocoding API for purposes of quota management. Its optional but recommended.
Geocode.setApiKey(process.env.REACT_APP_GCP_KEY);
Geocode.setLanguage("en");
Geocode.setRegion("ca");

const LinkTheme = {textDecoration: "None", color: "black"};

class MainPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      postings: [],
      latlng: [],
      loading: true,
      loadError: false,
      authorized: false,
      authObject: {},
      toggleModal: false,
    };
  }

  componentDidMount() {
    this.getPostings();
    api.get("user/isAuth")
      .then(res => this.setState({ authorized: true, authObject: res.data }))
      .catch(() => this.setState({ authorized: false }));
  }

  getPostings = async () => {
    try {
      const res = await api.get("posting/all");
      this.setState({ postings: res.data, loading: false, loadError: false }, this.getLatLng);
    } catch (err) {
      console.error("Posting retrieval failed", err);
      this.setState({ loading: false, loadError: true });
    }
  }

  getLatLng = async () => {
    const results = await Promise.all(
      this.state.postings.map((posting) =>
        Geocode.fromAddress(posting.fromRestaurantAddress)
          .then((res) => {
            const { lat, lng } = res.results[0].geometry.location;
            return { lat, lng, name: posting.fromRestaurantName };
          })
          .catch(() => null) // an address Google can't find just has no pin
      )
    );
    this.setState({ latlng: results.filter(Boolean) });
  }

  handleCreated = () => {
    this.setState({ toggleModal: false });
    this.getPostings();
  }

  renderPostings() {
    const { postings, loading, loadError } = this.state;
    if (loading) return <p className="empty-state">Loading postings…</p>;
    if (loadError) return <p className="empty-state">Couldn't load postings. Please refresh the page.</p>;
    if (postings.length === 0) {
      return <p className="empty-state">No food is waiting for pickup right now. Check back soon.</p>;
    }
    return postings.map((posting) => <PostingTile key={posting._id} postingData={posting} />);
  }

  render() {
    const { authorized: auth, authObject, latlng } = this.state;
    const canPost = auth && !authObject.isFoodbank;
    return (
      <>
        {this.state.toggleModal && (
          <CreatePostingModal
            onClose={() => this.setState({ toggleModal: false })}
            onCreated={this.handleCreated}
          />
        )}
        <div className='container flex-column center-center' >

          <div className="flex-row space-between welcome-banner">
            <div className='flex-row start-center'>
              <Link to="/main">
                <img src='images/logo.png' alt="MealDrop home" width="90px"></img>
              </Link>
              <div className="welcome">
                Welcome {!auth ? "Guest" : authObject.name}!
              </div>
            </div>
            <Link style={LinkTheme} to={auth ? "/view_profile" : "/auth"}>
              <Button variant="outlined">
                {auth ? "Manage Personal Info" : "Sign Up / Log In"}
              </Button>
            </Link>
          </div>
          <div className='flex-row space-between start main-container'>
            <div className='postings-row'>
              {canPost && (
                <Button variant="contained" sx={{ width: "100%", height: "45px" }} onClick={() => { this.setState({ toggleModal: true }) }} >Create a Posting</Button>
              )}
              {this.renderPostings()}
            </div>
            <div className='maps-row'>
              <SimpleMap latlng={latlng} />
            </div>
          </div>
        </div>
      </>
    )
  }
}

export default MainPage;
