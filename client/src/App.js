import "./styles.css";
import { BrowserRouter, Route, Switch } from "react-router-dom";
// import React, { useState, useEffect} from "react"
import LandingPage from "./components/LandingPage/LandingPage";
import Header from "./components/Header/Header";
import MainPage from "./components/MainPage/MainPage";
import AuthPage from "./components/AuthPage/AuthPage";
import ProfilePage from "./components/ProfilePage/ProfilePage";
import ViewPost from "./components/ViewPost/ViewPost";
import ConfirmOrder from "./components/ConfirmOrder/ConfirmOrder";

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
        </Switch>
      </div>
    </BrowserRouter>
  );
}