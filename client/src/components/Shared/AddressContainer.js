// Main Imports
import { React, Component } from "react";

// Material UI imports
import { TextField } from "@mui/material";

// css imports
import "./AddressContainer.css";

class AddressContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  render() {
    return (
      <>
        <div className="flex-column center-center">
          <div className="flex-column">
            {!this.props.profile && (
              <div className="address-box">Pickup Address</div>
            )}
            <div className="flex-row address-box">
              <TextField label="Street Address" fullWidth size="small" onChange={() => { this.props.changeValue("street", event.target.value) }} />
            </div>
            <div className="flex-row address-box space-between">
              <TextField className="half-address" label="City" size="small" onChange={() => { this.props.changeValue("city", event.target.value) }} />
              <TextField className="half-address" label="Postal Code" size="small" onChange={() => { this.props.changeValue("postalCode", event.target.value) }} />
            </div>
            <div className="flex-row address-box space-between">
              <TextField className="half-address" label="Country" size="small" onChange={() => { this.props.changeValue("country", event.target.value) }} />
              <TextField className="half-address" label="Province" size="small" onChange={() => { this.props.changeValue("province", event.target.value) }} />
            </div>
          </div>
        </div>
      </>
    )
  }

}

export default AddressContainer;
