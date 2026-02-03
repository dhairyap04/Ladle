import { React, Component } from "react";
import GoogleMapReact from 'google-map-react';

const TextComponent = ({ text }) => (
  <div style={{
    color: 'white',
    background: 'blue',
    padding: '10px',
    opacity: '60%',
    display: 'inline-flex',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '100%',
    transform: 'translate(-50%, -50%)'
  }}>
    {text}
  </div>
);

class SimpleMap extends Component {
  render() {
    var defaultProps = {
      center: { lat: 53.5052, lng: -113.4938 },
      zoom: 11
    };
    console.log(this.props.latlng);
    return (
      <GoogleMapReact
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
        bootstrapURLKeys={{ key: process.env.REACT_APP_GCP_KEY }}
      >
        {this.props.latlng.map((latlng, index) => {
          return <TextComponent
            key={index}
            lat={latlng.lat}
            lng={latlng.lng}
            text={latlng.name}
          />
        })}

      </GoogleMapReact>
    );
  }
}

export default SimpleMap;
