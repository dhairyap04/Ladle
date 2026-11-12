// Main imports
import { Alert, Button, TextField } from '@mui/material';
import { Component } from 'react'

// Root Imports
import AddressContainer from '../../Shared/AddressContainer';
import api, { errorMessage } from '../../../api';
import { localDateTimeToIso, todayDateInput, toTimeInput } from '../../../time';

// css imports
import "./CreatePosting.css";

// Creates a posting, or edits one when given a `posting` prop.
class CreatePostingModal extends Component {
  constructor(props) {
    super(props);
    const posting = props.posting;
    this.state = {
      // Create uses separate address parts; edit shows the saved address as one field.
      street: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      address: posting ? posting.fromRestaurantAddress : "",
      pickupDate: (posting && posting.pickupDate) || todayDateInput(),
      pickupTimeBegin: posting ? toTimeInput(posting.pickupTimeBegin) : "",
      pickupTimeEnd: posting ? toTimeInput(posting.pickupTimeEnd) : "",
      notes: posting ? posting.notes || "" : "",
      error: "",
      submitting: false,
    };
  }

  isEdit() {
    return Boolean(this.props.posting);
  }

  changeValue = (field, value) => {
    this.setState({ [field]: value });
  }

  fullAddress() {
    if (this.isEdit()) return this.state.address.trim();
    const { street, city, province, postalCode, country } = this.state;
    return [street, city, province, postalCode, country]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }

  validate() {
    const { street, city, address, pickupDate, pickupTimeBegin, pickupTimeEnd } = this.state;
    if (this.isEdit() ? !address.trim() : !street.trim() || !city.trim()) {
      return this.isEdit() ? "Please enter the pickup address." : "Please enter the street address and city.";
    }
    if (!pickupDate) return "Please enter the pickup date.";
    if (!pickupTimeBegin || !pickupTimeEnd) return "Please enter the pickup start and end times.";
    if (pickupTimeEnd <= pickupTimeBegin) return "The pickup end time must be after the start time.";
    if (new Date(`${pickupDate}T${pickupTimeEnd}`) <= new Date()) {
      return "That pickup window has already ended. Please choose a later date or time.";
    }
    return "";
  }

  submitForm = async () => {
    const error = this.validate();
    if (error) {
      this.setState({ error });
      return;
    }

    const { pickupDate, pickupTimeBegin, pickupTimeEnd, notes } = this.state;
    const body = {
      fromRestaurantAddress: this.fullAddress(),
      pickupDate,
      pickupEndsAt: localDateTimeToIso(pickupDate, pickupTimeEnd),
      pickupTimeBegin,
      pickupTimeEnd,
      notes,
    };

    this.setState({ error: "", submitting: true });
    try {
      const res = this.isEdit()
        ? await api.post(`posting/${this.props.posting._id}/edit`, body)
        : await api.post("posting/create", body);
      this.props.onSaved(res.data);
    } catch (err) {
      this.setState({ error: errorMessage(err), submitting: false });
    }
  }

  render() {
    const title = this.isEdit() ? "Edit Posting" : "Create a Posting";
    return (
      <div className="modal-container">
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-posting-title">
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className="modal-title" id="create-posting-title">{title}</div>
            <button type="button" className="close-button" aria-label="Close" onClick={this.props.onClose}>
              <img src="/images/close-button.svg" alt="" className="close-image" />
            </button>
          </div>
          {this.state.error && (
            <Alert severity="error" sx={{ width: "100%", boxSizing: "border-box", mb: 2 }}>{this.state.error}</Alert>
          )}
          <div className="flex-row" style={{ width: "100%", justifyContent: "space-between" }}>
            <div className='flex-column create-posting-left'>
              {this.isEdit() ? (
                <TextField
                  required
                  value={this.state.address}
                  onChange={(e) => this.changeValue("address", e.target.value)}
                  fullWidth
                  size="small"
                  label="Pickup Address"
                />
              ) : (
                <AddressContainer changeValue={this.changeValue} />
              )}
              <TextField
                type="date"
                required
                value={this.state.pickupDate}
                onChange={(e) => this.changeValue("pickupDate", e.target.value)}
                className="pickup-period"
                fullWidth
                size="small"
                label="Pickup Date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: todayDateInput() }}
              />
              <TextField
                type="time"
                required
                value={this.state.pickupTimeBegin}
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
                value={this.state.pickupTimeEnd}
                onChange={(e) => this.changeValue("pickupTimeEnd", e.target.value)}
                className="pickup-period"
                fullWidth
                size="small"
                label="Pickup End"
                InputLabelProps={{ shrink: true }}
              />
            </div>
            <div className='flex-column create-posting-left'>
              <TextField
                value={this.state.notes}
                onChange={(e) => this.changeValue("notes", e.target.value)}
                className="pickup-notes"
                multiline
                fullWidth
                rows={6}
                size="large"
                label="Pickup Notes"
                placeholder="What food is it, how much, and anything the driver should know"
              />
            </div>
          </div>
          <Button onClick={this.submitForm} disabled={this.state.submitting} variant="contained" style={{width: "25%"}} className="create-posting">
            {this.state.submitting ? "Saving…" : this.isEdit() ? "Save changes" : "Create"}
          </Button>
        </div>
      </div>
    )
  }
}

export default CreatePostingModal;
