// Main imports
import { Component } from "react";
import { Link } from "react-router-dom";

// CSS imports
import "./PostingTile.css";

// Root imports
import { formatPickupDate, formatPickupTime, STATUS_LABELS } from "../../../time";

const LinkTheme = {textDecoration: "None", color: "black"};

class PostingTile extends Component {
  render() {
    const posting = this.props.postingData;
    return (
      <Link to={`/view_post/${posting._id}`} style={LinkTheme}>
        <div className="flex-row posting-row tile-container start-center">
          <img className="posting-image" alt="" src="https://www.svgrepo.com/show/58017/restaurant-symbol-of-cutlery-in-a-circle.svg"></img>
          <div className="flex-column start-center restaurant-details">
            <p className="title">
              {posting.fromRestaurantName}
              {this.props.showStatus && (
                <span className={`status-chip status-${posting.status || "open"}`}>
                  {STATUS_LABELS[posting.status || "open"]}
                </span>
              )}
            </p>
            <p className="address">{posting.fromRestaurantAddress}</p>
            <p className="pickupTimes">
              Pickup: {posting.pickupDate ? `${formatPickupDate(posting.pickupDate)}, ` : ""}
              {formatPickupTime(posting.pickupTimeBegin)} - {formatPickupTime(posting.pickupTimeEnd)}
            </p>
          </div>
        </div>
      </Link>
    )
  }
}

export default PostingTile;
