import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import AppHeader from '../Shared/AppHeader';
import useAuthUser from '../../useAuthUser';

const ConfirmOrder = () => {
    const user = useAuthUser();
    return (
        <>
            <AppHeader user={user} />
            <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 5, textAlign: "center" }}>
                    <Box component="img" src="/images/pickup-confirmed.svg" alt="" sx={{ width: 220, maxWidth: "100%" }} />
                    <Typography component="h1" variant="h4" sx={{ mt: 2, color: "primary.dark" }}>
                        Pickup reserved!
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1.5 }}>
                        The food is held for your food bank. Please collect it during the pickup window, then mark it as picked up. Thank you for helping keep good food out of the bin.
                    </Typography>
                    <Button component={RouterLink} to="/main" variant="contained" size="large" sx={{ mt: 4 }}>
                        See your pickups
                    </Button>
                </Paper>
            </Container>
        </>
    );
};

export default ConfirmOrder;
