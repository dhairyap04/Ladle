import React, { useState, useEffect } from 'react';
import { Redirect, useHistory } from "react-router-dom";
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import Container from '@mui/material/Container';
import Select from '@mui/material/Select';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from "axios"
import "./AuthPage.css";

const theme = createTheme();

function SignIn(props) {

    const [isLogin, setIsLogin] = useState(false);
    const [isFoodbank, setFoodbank] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        let email = data.get('email');
        let password = data.get('password');
        
        if (isLogin) {
            axios.post(`${process.env.REACT_APP_HOST_URL}user/login`,{ email, password }, { withCredentials: true })
                .then(res => {
                    console.log("Redirecting!!!");
                    props.history.push("/main");
                })
                .catch(e => {
                    alert(e.response.data.msg);
                });
        } else {
            let name = data.get('name');
            axios.post(`${process.env.REACT_APP_HOST_URL}user/create`, { email, password, name, isFoodbank }, { withCredentials: true })
                .then(res => {
                    props.history.push("/view_profile");
                })
                .catch(e => {
                    alert(e.response.data);
                });
        }


    };

    const handleChangeFoodBank = (e) => {
        setFoodbank(e.target.value);
    }

    const toggleLogin = () => {
        setIsLogin(prev => !prev);
    }

    return (
        <ThemeProvider theme={theme}>
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <Box
            sx={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
            >
            <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                <LockOutlinedIcon />
            </Avatar>

            <Typography component="h1" variant="h5">
            { isLogin ? "Log In" : "Sign Up" }
            </Typography>
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                {!isLogin && <TextField
                margin="normal"
                required
                fullWidth
                id="name"
                label="Name"
                name="name"
                autoFocus
                />}
                
                <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                />
                <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                />

                {!isLogin && <>
                    <InputLabel id="foodbank-label">Are you a food bank?</InputLabel>
                    <Select
                    labelId="foodbank-label"
                    id="isFoodbank"
                    value={isFoodbank}
                    // label="foodbank?"
                    fullWidth
                    onChange={handleChangeFoodBank}
                    >
                        <MenuItem value={true}>Yes</MenuItem>
                        <MenuItem value={false}>No</MenuItem>
                    </Select>
                </>}

                <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                >
                { isLogin ? "Log In" : "Sign Up" }
                </Button>
                <Button
                    color="secondary"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, mb: 2 }}
                    style={{margin: 0}}
                    onClick={toggleLogin}
                >
                { isLogin ? "Or Sign-Up Instead?" : "Or log-in Instead?"}
                </Button>
            </Box>
            </Box>
        </Container>
        </ThemeProvider>
    );
}

const AuthPage = () => {

    const history = useHistory();

    useEffect(async () => {
        await axios.get(`${process.env.REACT_APP_HOST_URL}user/isAuth`, { withCredentials: true })
            .then(res => {
                alert("You're already logged in!");
            })
            .catch(e => {
                console.log(e.response);
            });
    }, [])

    return (
        <div id="auth_page" className="flex-column center-center">
            <SignIn history={history} />
        </div>
    )
}

export default AuthPage;


