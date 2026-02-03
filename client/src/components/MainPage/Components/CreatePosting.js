// Main imports
import { Button, TextField } from '@mui/material';
import { React, Component } from 'react'
import axios from "axios";

// Root Imports
import AddressContainer from '../../Shared/AddressContainer';

// css imports
import "./CreatePosting.css";

class CreatePostingModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      street: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      pickupTimeBegin: "",
      pickupTimeEnd: "",
      notes: "",
    };
  }

  changeValue = (value, param) => {
    this.setState({ [value]: param });
  }

  componentDidUpdate() {
    console.log(this.state);
  }

  submitForm() {
    var { street, city, province, postalCode, country } = this.state;
    var overallAddress = [street, city, province, postalCode, country].join(' ');

    var createPostingURL = `${process.env.REACT_APP_HOST_URL}posting/create`;

    axios.post(createPostingURL, {
      fromRestaurantAddress: overallAddress,
      pickupTimeBegin: this.state.pickupTimeBegin,
      pickupTimeEnd: this.state.pickupTimeEnd,
      notes: this.state.notes,
    }, { withCredentials: true }).then(res => {
      console.log("Posting Successfully Created!");
      this.props.changeValue("toggleModal", false);
      this.forceUpdate();
    }).catch(err => {
      console.log("Error: ", err);
    })
  }

  render() {
    return (
      <div className="modal-container">
        <div className="modal">
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className="modal-title">Create a Posting</div>
            <img src="images/close-button.svg" className='close-image' onClick={() => this.props.changeValue("toggleModal", false)} />
          </div>
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className='flex-column create-posting-left'>
              <AddressContainer changeValue={this.changeValue.bind(this)} />
              <TextField onChange={() => { this.setState({ pickupTimeBegin: event.target.value }) }} className="pickup-period" fullWidth size="small" label="Pickup Start Period (HH:MM)" />
              <TextField onChange={() => { this.setState({ pickupTimeEnd: event.target.value }) }} className="pickup-period" fullWidth size="small" label="Pickup End Period (HH:MM)" />
            </div>
            <div className='flex-column create-posting-left'>
              <TextField onChange={() => { this.setState({ notes: event.target.value }) }} className="pickup-notes" multiline fullWidth rows={6} size="large" label="Pickup Notes" />
            </div>
          </div>
          <Button onClick={() => this.submitForm()} variant="contained" style={{width: "25%"}} className="create-posting">
            Create
          </Button>
        </div>
      </div>
    )
  }
}

export default CreatePostingModal;

