import { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import Alert from '@mui/material/Alert';
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
import api, { errorMessage } from "../../api";
import "./AuthPage.css";

const theme = createTheme();

function SignIn({ history }) {
    const [isLogin, setIsLogin] = useState(false);
    const [isFoodbank, setFoodbank] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const email = (data.get('email') || "").trim();
        const password = data.get('password') || "";
        const name = (data.get('name') || "").trim();

        if (!email || !password || (!isLogin && !name)) {
            setError("Please fill in all the required fields.");
            return;
        }
        if (!isLogin && password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            if (isLogin) {
                await api.post("user/login", { email, password });
                history.push("/main");
            } else {
                await api.post("user/create", { email, password, name, isFoodbank });
                history.push("/view_profile");
            }
        } catch (e) {
            setError(errorMessage(e));
            setSubmitting(false);
        }
    };

    const toggleLogin = () => {
        setError("");
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
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: "100%" }}>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

                {!isLogin && <TextField
                margin="normal"
                required
                fullWidth
                id="name"
                label="Organization name"
                name="name"
                autoComplete="organization"
                />}

                <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                />
                <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                helperText={isLogin ? undefined : "At least 8 characters"}
                />

                {!isLogin && <>
                    <InputLabel id="foodbank-label">Are you a food bank?</InputLabel>
                    <Select
                    labelId="foodbank-label"
                    id="isFoodbank"
                    value={isFoodbank}
                    fullWidth
                    onChange={(e) => setFoodbank(e.target.value === true)}
                    >
                        <MenuItem value={true}>Yes, we collect food</MenuItem>
                        <MenuItem value={false}>No, we&apos;re a restaurant donating food</MenuItem>
                    </Select>
                </>}

                <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={submitting}
                sx={{ mt: 3, mb: 2 }}
                >
                { submitting ? "Please wait…" : isLogin ? "Log In" : "Sign Up" }
                </Button>
                <Button
                    fullWidth
                    variant="text"
                    onClick={toggleLogin}
                >
                { isLogin ? "New here? Sign up instead" : "Already have an account? Log in" }
                </Button>
            </Box>
            </Box>
        </Container>
        </ThemeProvider>
    );
}

const AuthPage = () => {
    const history = useHistory();

    useEffect(() => {
        // Already signed in: skip the form.
        api.get("user/isAuth")
            .then(() => history.replace("/main"))
            .catch(() => {});
    }, [history]);

    return (
        <div id="auth_page" className="flex-column center-center">
            <SignIn history={history} />
        </div>
    )
}

export default AuthPage;
