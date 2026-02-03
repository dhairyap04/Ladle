import React from 'react';
import { Link } from "react-router-dom";
import "./LandingPage.css";
import { Button } from '@mui/material';
import "../../global.css";

const buttonTheme = { marginRight: "30px", color: "black", border: "2px solid grey" }
const LinkTheme = { textDecoration: "None", color: "black" };

const LandingPage = () => {
    return (
        <div id='landingpage'>
            <div id="buttons" >
                <Button variant="outlined" style={buttonTheme}>
                    <Link style={LinkTheme} to="/main">Browse As Guest</Link>
                </Button>
                <Button variant="outlined" style={buttonTheme} >
                    <Link to="/auth" style={LinkTheme}>Sign-Up / Login</Link>
                </Button>
            </div>
            <div id="text">
                <h1>MealDrop</h1>
                <h3>Reducing Food Waste. One Meal at a Time.</h3>
                <p>Mealdrop is an ingenious application that helps solve food waste absolutely for free! Restaurants with extra food can creating a posting within minutes, detailing the food and pickup options. Once a food bank notices a nearby posting, they can submit a pickup request and collect the extra food whenever they wish.
                </p>
            </div>
        </div>
    )
}

export default LandingPage;