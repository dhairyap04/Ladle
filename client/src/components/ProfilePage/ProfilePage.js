// main imports
import { React, Component } from 'react'
import { Link } from 'react-router-dom';
import axios from 'axios';

// mui imports
import { Button, TextField } from '@mui/material';

// css imports
import "../../global.css";
import "./ProfilePage.css";
import "../MainPage/Components/CreatePosting.css";

// Root imports
import AddressContainer from "../Shared/AddressContainer.js";


class ProfilePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      street: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      name: "",
      phoneNumber: "",
      website: "",
      openHours: "-",
      charitableTaxNum: "",
    };
  }

  changeValue = (value, param) => {
    this.setState({ [value]: param });
  }

  updateProfile() {
    var { street, city, province, postalCode, country } = this.state;
    var overallAddress = [street, city, province, postalCode, country].join(' ');

    var updateURL = `${process.env.REACT_APP_HOST_URL}user/update`;

    console.log('here');

    axios.post(updateURL, {
      ...this.state,
      address: overallAddress,
    }, { withCredentials: true }).then(res => {
      console.log("User Successfully Updated!");
      this.props.history.push("/main");
    }).catch(err => {
      console.log("Error: ", err);
    })

  }

  openHoursFunction = (start, end) => {
    var openHours = this.state.openHours;
    if (start.length != 0) {
      openHours = openHours.split("-");
      openHours[0] = start;
      openHours = openHours.join("-");
    } else {
      openHours = openHours.split("-");
      openHours[1] = end;
      openHours = openHours.join("-");
    }
    this.setState({ openHours: openHours }, () => { console.log(this.state) })
  }

  render() {
    return (
      <div className='container flex-column center-center' >
        <div className="flex-row start-center">
          <Link to="/main">
            <img src='images/logo.png' width="90px"></img>
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
        <div className='flex-row' style={{ justifyContent: "space-between" }}>
          <div className='create-posting-left ' style={{ marginTop: "20px" }}>
            <TextField onChange={() => this.setState({ name: event.target.value })} className="textfield-data" fullWidth size="large" label="Name"></TextField>
            <TextField onChange={() => this.setState({ phoneNumber: event.target.value })} className="textfield-data" fullWidth size="large" label="Phone Number"></TextField>
            <TextField onChange={() => this.setState({ charitableTaxNum: event.target.value })} style={{ marginTop: "18px" }} className="textfield-data" fullWidth size="large" label="Charitable Org. # (Food Banks Only)"></TextField>
          </div>
          <div className='create-posting-left' style={{ marginTop: "20px" }}>
            <AddressContainer profile changeValue={this.changeValue.bind(this)}></AddressContainer>
            <TextField onChange={() => this.setState({ website: event.target.value })} style={{ marginTop: "20px" }} className="textfield-data" fullWidth size="large" label="Website"></TextField>
            <div className='flex-row' style={{ justifyContent: "space-between" }}>
              <TextField onChange={() => this.openHoursFunction(event.target.value, "")} style={{ width: "49%" }} className="textfield-data" fullWidth size="large" label="Opening Hours (HH:MM)"></TextField>
              <TextField onChange={() => this.openHoursFunction("", event.target.value)} style={{ width: "49%" }} className="textfield-data" fullWidth size="large" label="Closing Hours (HH:MM)"></TextField>
            </div>
          </div>
        </div>
        <Button onClick={() => this.updateProfile()} style={{ marginTop: "20px" }} variant="contained">
          Update Profile
        </Button>
      </div >
    )
  }
}

export default ProfilePage;