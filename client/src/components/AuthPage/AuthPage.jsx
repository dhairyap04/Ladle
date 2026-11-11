import { useState, useEffect } from 'react';
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Container,
    Link,
    Paper,
    TextField,
    Typography,
} from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import api, { errorMessage } from "../../api";
import AppHeader from "../Shared/AppHeader";
import usePageTitle from "../../usePageTitle";

const ROLES = [
    { value: "restaurant", icon: StorefrontRoundedIcon, title: "Restaurant", text: "I have surplus food to donate" },
    { value: "foodbank", icon: VolunteerActivismRoundedIcon, title: "Food bank", text: "We collect food for people in need" },
    { value: "driver", icon: LocalShippingRoundedIcon, title: "Volunteer driver", text: "I can deliver food for food banks" },
];

const NAME_LABELS = { restaurant: "Restaurant name", foodbank: "Food bank name", driver: "Your name" };

// One of the "who are you?" cards on the sign-up form.
const RoleCard = ({ role, selected, onSelect }) => {
    const Icon = role.icon;
    return (
        <ButtonBase
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            focusRipple
            sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                textAlign: "left",
                gap: 0.5,
                p: 2,
                borderRadius: 3,
                border: 2,
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: selected ? "primary.light" : "#fff",
                transition: "border-color 120ms, background-color 120ms",
                "&:hover": { borderColor: "primary.main" },
            }}
        >
            <Icon sx={{ color: "primary.main", fontSize: 30 }} />
            <Typography sx={{ fontWeight: 800 }}>{role.title}</Typography>
            <Typography variant="body2" color="text.secondary">{role.text}</Typography>
            {selected && (
                <CheckCircleRoundedIcon sx={{ position: "absolute", top: 10, right: 10, color: "primary.main" }} fontSize="small" />
            )}
        </ButtonBase>
    );
};

function AuthForm({ history, initialLogin, initialRole }) {
    const [isLogin, setIsLogin] = useState(initialLogin);
    const [role, setRole] = useState(initialRole);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const email = (data.get('email') || "").trim();
        const password = data.get('password') || "";
        const name = (data.get('name') || "").trim();

        if (!isLogin && role === null) {
            setError("Please choose whether you're a restaurant, a food bank or a volunteer driver.");
            return;
        }
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
                await api.post("user/create", { email, password, name, role });
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
    };

    return (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
            <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>
                {isLogin ? "Welcome back" : "Join Ladle"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
                {isLogin ? "Log in to see your postings and pickups." : "It's free for restaurants and food banks."}
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {!isLogin && (
                    <>
                        <Typography id="role-label" sx={{ fontWeight: 700, mb: 1 }}>I&apos;m signing up as a…</Typography>
                        <Box role="radiogroup" aria-labelledby="role-label" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mb: 1 }}>
                            {ROLES.map((option) => (
                                <RoleCard
                                    key={option.value}
                                    role={option}
                                    selected={role === option.value}
                                    onSelect={() => setRole(option.value)}
                                />
                            ))}
                        </Box>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="name"
                            label={NAME_LABELS[role] || "Name"}
                            name="name"
                            autoComplete={role === "driver" ? "name" : "organization"}
                        />
                    </>
                )}

                <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="email"
                    label="Email address"
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
                {isLogin && (
                    <Box sx={{ textAlign: "right" }}>
                        <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ fontWeight: 600 }}>
                            Forgot your password?
                        </Link>
                    </Box>
                )}

                <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting} sx={{ mt: 3 }}>
                    {submitting ? "Please wait…" : isLogin ? "Log in" : "Create account"}
                </Button>
                <Button fullWidth variant="text" onClick={toggleLogin} sx={{ mt: 1 }}>
                    {isLogin ? "New here? Create an account" : "Already have an account? Log in"}
                </Button>
                {!isLogin && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
                        By creating an account you agree to the <Link component={RouterLink} to="/terms">terms of use</Link> and{" "}
                        <Link component={RouterLink} to="/privacy">privacy policy</Link>.
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}

const AuthPage = () => {
    const history = useHistory();
    const params = new URLSearchParams(useLocation().search);
    usePageTitle(params.get("mode") === "login" ? "Log in" : "Join");
    const requested = params.get("role");
    const initialRole = ["restaurant", "foodbank", "driver"].includes(requested) ? requested : null;

    useEffect(() => {
        // Already signed in: skip the form.
        api.get("user/isAuth")
            .then(() => history.replace("/main"))
            .catch(() => {});
    }, [history]);

    return (
        <>
            <AppHeader user={null} />
            <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, md: 7 } }}>
                <AuthForm
                    key={params.toString()} // header links change the query; start the form fresh
                    history={history}
                    initialLogin={params.get("mode") === "login"}
                    initialRole={initialRole}
                />
            </Container>
        </>
    );
};

export default AuthPage;
