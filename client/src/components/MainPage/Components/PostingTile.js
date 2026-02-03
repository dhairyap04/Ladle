// Main imports
import { React, Component } from "react";
import { Redirect, Link } from "react-router-dom";

// CSS imports
import "./PostingTile.css";

// Root imports
export function tConvert(time) {
  var isPm = false;
  if (time > 1200) {
    isPm = true;
    time -= 1200;
  }
  time = time.toString();
  if (time.length == 4) {
    time = [time.slice(0, 2), ":", time.slice(2), " ", isPm? "PM" : "AM"].join('');
  } else {
    time = [time.slice(0, 1), ":", time.slice(1), " ", isPm? "PM" : "AM"].join('');
  }
  return time;
}

const LinkTheme = {textDecoration: "None", color: "black"};

class PostingTile extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
  }

  // handleClick = () => {
  //   console.log(this.props.postingData._id);
  //   return <Redirect to={`/view_post/${this.props.postingData._id}`} />
  // }

  render() {
    return (
      <Link to={`/view_post/${this.props.postingData._id}`} style={LinkTheme}> 
        <div className="flex-row posting-row tile-container start-center">
          <img className="posting-image" src="https://www.svgrepo.com/show/58017/restaurant-symbol-of-cutlery-in-a-circle.svg"></img>
          <div className="flex-column start-center restaurant-details">
            <p className="title">{this.props.postingData.fromRestaurantName}</p>
            <p className="address">{this.props.postingData.fromRestaurantAddress}</p>
            <p className="pickupTimes">Pickup Time: {tConvert(this.props.postingData.pickupTimeBegin)} - {tConvert(this.props.postingData.pickupTimeEnd)}</p>
          </div>
        </div>
      </Link>
    )
  }
}

export default PostingTile;
