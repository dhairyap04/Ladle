// Main imports
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Component } from 'react'

// Root Imports
import AddressContainer from '../../Shared/AddressContainer';
import api, { errorMessage } from '../../../api';
import { localDateTimeToIso, todayDateInput, toTimeInput } from '../../../time';

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
    const title = this.isEdit() ? "Edit posting" : "Post surplus food";
    const field = (name, label, extra = {}) => (
      <TextField
        value={this.state[name]}
        onChange={(e) => this.changeValue(name, e.target.value)}
        fullWidth
        label={label}
        {...extra}
      />
    );
    return (
      <Dialog open onClose={this.props.onClose} fullWidth maxWidth="sm" aria-labelledby="posting-dialog-title">
        <DialogTitle id="posting-dialog-title" sx={{ pr: 7 }}>
          <Typography component="span" variant="h5" sx={{ display: "block", color: "primary.dark" }}>{title}</Typography>
          <Typography component="span" variant="body2" color="text.secondary">
            Nearby food banks will see this and can claim it.
          </Typography>
          <IconButton aria-label="Close" onClick={this.props.onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {this.state.error && <Alert severity="error" sx={{ mb: 2 }}>{this.state.error}</Alert>}
          <Stack spacing={3}>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Where</Typography>
              {this.isEdit()
                ? field("address", "Pickup address", { required: true })
                : <AddressContainer changeValue={this.changeValue} />}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>When</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1fr 1fr" }, gap: 1.5 }}>
                {field("pickupDate", "Pickup date", { type: "date", required: true, InputLabelProps: { shrink: true }, inputProps: { min: todayDateInput() } })}
                {field("pickupTimeBegin", "From", { type: "time", required: true, InputLabelProps: { shrink: true } })}
                {field("pickupTimeEnd", "Until", { type: "time", required: true, InputLabelProps: { shrink: true } })}
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>What</Typography>
              {field("notes", "About the food", {
                multiline: true,
                minRows: 3,
                placeholder: "e.g. 2 trays of roasted vegetables and 10 sandwiches, contains nuts. Ask at the back door.",
              })}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={this.props.onClose} color="inherit">Cancel</Button>
          <Button onClick={this.submitForm} disabled={this.state.submitting} variant="contained">
            {this.state.submitting ? "Saving…" : this.isEdit() ? "Save changes" : "Post it"}
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

export default CreatePostingModal;
