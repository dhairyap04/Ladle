// Main imports
import { Alert, Button, TextField } from '@mui/material';
import { Component } from 'react'

// Root Imports
import AddressContainer from '../../Shared/AddressContainer';
import api, { errorMessage } from '../../../api';

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
      error: "",
      submitting: false,
    };
  }

  changeValue = (field, value) => {
    this.setState({ [field]: value });
  }

  validate() {
    const { street, city, pickupTimeBegin, pickupTimeEnd } = this.state;
    if (!street.trim() || !city.trim()) return "Please enter the street address and city.";
    if (!pickupTimeBegin || !pickupTimeEnd) return "Please enter the pickup start and end times.";
    if (pickupTimeEnd <= pickupTimeBegin) return "The pickup end time must be after the start time.";
    return "";
  }

  submitForm = async () => {
    const error = this.validate();
    if (error) {
      this.setState({ error });
      return;
    }

    const { street, city, province, postalCode, country } = this.state;
    const overallAddress = [street, city, province, postalCode, country]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

    this.setState({ error: "", submitting: true });
    try {
      await api.post("posting/create", {
        fromRestaurantAddress: overallAddress,
        pickupTimeBegin: this.state.pickupTimeBegin,
        pickupTimeEnd: this.state.pickupTimeEnd,
        notes: this.state.notes,
      });
      this.props.onCreated();
    } catch (err) {
      this.setState({ error: errorMessage(err), submitting: false });
    }
  }

  render() {
    return (
      <div className="modal-container">
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-posting-title">
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className="modal-title" id="create-posting-title">Create a Posting</div>
            <button type="button" className="close-button" aria-label="Close" onClick={this.props.onClose}>
              <img src="images/close-button.svg" alt="" className="close-image" />
            </button>
          </div>
          {this.state.error && (
            <Alert severity="error" sx={{ width: "100%", boxSizing: "border-box", mb: 2 }}>{this.state.error}</Alert>
          )}
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className='flex-column create-posting-left'>
              <AddressContainer changeValue={this.changeValue} />
              <TextField
                type="time"
                required
                onChange={(e) => this.changeValue("pickupTimeBegin", e.target.value)}
                className="pickup-period"
                fullWidth
                size="small"
                label="Pickup Start"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="time"
                required
                onChange={(e) => this.changeValue("pickupTimeEnd", e.target.value)}
                className="pickup-period"
                fullWidth
                size="small"
                label="Pickup End"
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div className='flex-column create-posting-left'>
              <TextField onChange={(e) => this.changeValue("notes", e.target.value)} className="pickup-notes" multiline fullWidth rows={6} size="large" label="Pickup Notes" placeholder="What food is it, how much, and anything the driver should know" />
            </div>
          </div>
          <Button onClick={this.submitForm} disabled={this.state.submitting} variant="contained" style={{width: "25%"}} className="create-posting">
            {this.state.submitting ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    )
  }
}

export default CreatePostingModal;
