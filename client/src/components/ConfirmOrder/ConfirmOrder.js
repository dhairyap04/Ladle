import React from 'react'
import { Button } from '@mui/material';
import { Link } from 'react-router-dom';
import "../../global.css";
import "./ConfirmOrder.css";

const ConfirmOrder = () => {
    return (
        <div id="orderconfirmed">

            <img src="https://i.pinimg.com/originals/77/9b/9d/779b9dc3928c2dbc304bcf6702bef6df.gif" 
            alt="confirmation" 
            class="center" />
            <p>Delivery confirmed!</p>
            <p>Thank you for helping save food!</p>

            <Link to="/main" style={{ textDecoration: "none"}}>
                <Button variant="contained" style={{ marginTop: "50px" }}>
                    Back to main page
                </Button>
            </Link>
        </div>
    )
}

export default ConfirmOrder
