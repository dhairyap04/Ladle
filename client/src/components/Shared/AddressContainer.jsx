// Main Imports
import { Component } from "react";

// Material UI imports
import { TextField } from "@mui/material";

// css imports
import "./AddressContainer.css";

class AddressContainer extends Component {
  handle = (field) => (e) => this.props.changeValue(field, e.target.value);

  render() {
    return (
      <>
        <div className="flex-column center-center">
          <div className="flex-column">
            {!this.props.profile && (
              <div className="address-box">Pickup Address</div>
            )}
            <div className="flex-row address-box">
              <TextField label="Street Address" required fullWidth size="small" onChange={this.handle("street")} />
            </div>
            <div className="flex-row address-box space-between">
              <TextField className="half-address" label="City" required size="small" onChange={this.handle("city")} />
              <TextField className="half-address" label="Postal Code" size="small" onChange={this.handle("postalCode")} />
            </div>
            <div className="flex-row address-box space-between">
              <TextField className="half-address" label="Country" size="small" onChange={this.handle("country")} />
              <TextField className="half-address" label="Province" size="small" onChange={this.handle("province")} />
            </div>
          </div>
        </div>
      </>
    )
  }

}

export default AddressContainer;
