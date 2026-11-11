import "./styles.css";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import LandingPage from "./components/LandingPage/LandingPage";
import MainPage from "./components/MainPage/MainPage";
import AuthPage from "./components/AuthPage/AuthPage";
import ProfilePage from "./components/ProfilePage/ProfilePage";
import ViewPost from "./components/ViewPost/ViewPost";
import ConfirmOrder from "./components/ConfirmOrder/ConfirmOrder";
import ImpactPage from "./components/ImpactPage/ImpactPage";
import ReceiptPage from "./components/ReceiptPage/ReceiptPage";
import AdminPage from "./components/AdminPage/AdminPage";
import NotFound from "./components/NotFound";
import { ForgotPasswordPage, ResetPasswordPage } from "./components/AuthPage/PasswordPages";
import { FoodSafetyPage, PrivacyPage, TermsPage } from "./components/LegalPages/LegalPages";

export default function App() {

  return (
    <BrowserRouter>
      <div className="App">
        <Switch>
            <Route exact path="/" component={LandingPage} />
            <Route path="/main" component={MainPage} exact/>
            <Route path="/auth" component={AuthPage} exact/>
            <Route path="/view_profile" component={ProfilePage} exact/>
            <Route path="/confirmed" component={ConfirmOrder} exact />
            <Route path="/view_post/:id" component={ViewPost} exact />
            <Route path="/impact" component={ImpactPage} exact />
            <Route path="/receipt/:id" component={ReceiptPage} exact />
            <Route path="/admin" component={AdminPage} exact />
            <Route path="/forgot-password" component={ForgotPasswordPage} exact />
            <Route path="/reset-password" component={ResetPasswordPage} exact />
            <Route path="/privacy" component={PrivacyPage} exact />
            <Route path="/terms" component={TermsPage} exact />
            <Route path="/food-safety" component={FoodSafetyPage} exact />
            <Route component={NotFound} />
        </Switch>
      </div>
    </BrowserRouter>
  );
}