import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Container, Link, Paper, Typography } from "@mui/material";
import AppHeader from "../Shared/AppHeader";
import useAuthUser from "../../useAuthUser";
import usePageTitle from "../../usePageTitle";

// Shown on the legal pages. Set REACT_APP_CONTACT_EMAIL before launch.
const CONTACT = import.meta.env.REACT_APP_CONTACT_EMAIL;
const Contact = () =>
  CONTACT ? <Link href={`mailto:${CONTACT}`}>{CONTACT}</Link> : <strong>[contact email to be added before launch]</strong>;

const UPDATED = "November 11, 2026";

const H2 = ({ children }) => <Typography component="h2" variant="h6" sx={{ mt: 4, mb: 1 }}>{children}</Typography>;
const P = ({ children }) => <Typography sx={{ mb: 1.5, lineHeight: 1.7 }}>{children}</Typography>;
const Ul = ({ items }) => (
  <Box component="ul" sx={{ pl: 3, mt: 0, mb: 1.5, "& li": { mb: 0.75, lineHeight: 1.6 } }}>
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </Box>
);

const LegalLayout = ({ title, intro, children }) => {
  const user = useAuthUser();
  usePageTitle(title);
  return (
    <>
      <AppHeader user={user} />
      <Container component="main" maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 5 }}>
          <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Last updated {UPDATED}</Typography>
          {intro && <Typography sx={{ mt: 2, fontSize: "1.05rem" }}>{intro}</Typography>}
          {children}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 5 }}>
            See also: <Link component={RouterLink} to="/privacy">Privacy policy</Link> · <Link component={RouterLink} to="/terms">Terms of use</Link> ·{" "}
            <Link component={RouterLink} to="/food-safety">Food safety and donor protection</Link>
          </Typography>
        </Paper>
      </Container>
    </>
  );
};

export const PrivacyPage = () => (
  <LegalLayout title="Privacy policy" intro="What Ladle collects, why, who it's shared with, and how to see or delete it.">
    <H2>Who runs Ladle</H2>
    <P>Ladle is built and operated by Dhairya Prajapati. Questions about privacy, or requests about your information, go to <Contact />.</P>

    <H2>What we collect and why</H2>
    <Ul items={[
      <><strong>Account details</strong>: name, email, password (stored only as a bcrypt hash), account type, and optionally phone number, address, website and opening or receiving hours. Used to run your account and to let the people you work with on a pickup contact you.</>,
      <><strong>Food bank details</strong>: charitable registration number, what food you can accept, storage, capacity, receiving days and travel radius. Used to verify food banks and to show and alert you about suitable food.</>,
      <><strong>Volunteer driver details</strong>: vehicle type, how much you can carry, whether you have a cooler, availability, travel radius and a home area. Your home area is only used to find deliveries near you and is never shown to others.</>,
      <><strong>Postings and deliveries</strong>: pickup address, times, food description, allergens, storage and photos you add, and who claimed, collected and delivered them.</>,
      <><strong>Delivery handoffs</strong>: when a volunteer driver collects or drops off food, how it was confirmed (a handoff code or a photo), any photo they take of the food, and whether they were near the address. To check that, your device&apos;s location is sent at that moment if you allow it; we keep only &quot;near&quot;, &quot;far&quot; (with the distance) or &quot;not shared&quot;, never your coordinates. Problems that food banks or restaurants report about a delivery are also kept.</>,
      <><strong>Messages</strong> you send about postings and deliveries, and <strong>ratings</strong> you give and receive.</>,
      <><strong>Reliability history</strong>: completed, missed and released pickups or deliveries, used to show your track record to the people deciding whether to work with you.</>,
      <><strong>Notifications</strong> we send you, and, if you turn them on, a <strong>push notification address</strong> for your device.</>,
      <><strong>Location</strong>: addresses you save are converted to map coordinates for distance search. If you choose &quot;Use my location&quot;, your device&apos;s location is sent with that search only and isn&apos;t stored.</>,
    ]} />

    <H2>Who can see what</H2>
    <Ul items={[
      "Anyone can see open postings: restaurant name, pickup address and times, food details and photos.",
      "Once food is claimed or a driver accepts a delivery, the restaurant, food bank and driver involved can see each other's name and phone number.",
      "Signed-in users can see a food bank's or driver's track record and ratings.",
      "Handoff codes are only shown to the restaurant or food bank that gives them out. Handoff photos and how each handoff was confirmed are visible to the restaurant, food bank and driver on that delivery, and to Ladle admins.",
      "Ladle admins can see account details to verify food banks and review reliability flags.",
      "We don't sell your information or use it for advertising.",
    ]} />

    <H2>Services that process data for us</H2>
    <Ul items={[
      "Our hosting provider and database provider, which store Ladle's data.",
      "Our email provider, to send notifications and password reset emails.",
      "Google Maps and Geocoding, when enabled, receive addresses to place them on the map.",
      "Google Fonts serves the typeface, which means your browser contacts Google when pages load.",
      "Your browser's push service (for example Google or Apple) delivers push notifications if you turn them on.",
    ]} />

    <H2>Cookies and storage</H2>
    <P>Ladle uses two cookies to keep you signed in (an access token and a refresh token). They aren&apos;t used for tracking. Your browser also stores a few things on your device: small settings (such as whether you dismissed the &quot;install app&quot; prompt), who is signed in and, for drivers, your current deliveries, so the app still opens without signal, and any pickup or drop-off you recorded offline until it&apos;s sent. These are removed when you log out. The app itself is cached so it can open offline. If you untick &quot;Keep me signed in&quot;, the sign-in cookie lasts only until you close the browser.</P>

    <H2>How long we keep it</H2>
    <Ul items={[
      "Account information, postings, messages and ratings: until you delete your account.",
      "Notifications: 90 days.",
      "Password reset links: one hour.",
      "Reliability history: only the last 6 months count towards your track record. The history itself is deleted with your account.",
      "Handoff photos: until the driver who took them deletes their account.",
      "Completed pickups stay in the other organization's records after you delete your account, with your name replaced by \"Former Ladle member\".",
    ]} />

    <H2>Your choices</H2>
    <Ul items={[
      <>Download everything Ladle holds about you, or delete your account, from <Link component={RouterLink} to="/view_profile">your profile</Link>.</>,
      "Edit your details at any time on your profile.",
      "Turn email alerts, new-food or delivery alerts, and push notifications on or off.",
      <>Ask a question or make a privacy request at <Contact />. In Canada you can also contact the Office of the Privacy Commissioner of Canada, or your provincial privacy commissioner.</>,
    ]} />

    <H2>Security</H2>
    <P>Passwords are hashed, sessions use secure cookies, reset links are single-use and stored only as hashes, and logins are rate-limited. No system is perfectly secure; if we learn of a breach that affects you, we&apos;ll tell you.</P>

    <H2>Changes</H2>
    <P>If this policy changes in a way that matters, we&apos;ll update the date above and let signed-in users know in the app.</P>
  </LegalLayout>
);

export const TermsPage = () => (
  <LegalLayout title="Terms of use" intro="The ground rules for using Ladle. By creating an account you agree to them.">
    <H2>What Ladle is</H2>
    <P>Ladle is a free tool that helps restaurants offer surplus food to food banks, and helps volunteer drivers deliver it. Ladle doesn&apos;t buy, sell, store, handle, inspect or transport food itself. Donations, pickups and deliveries are arranged directly between the people involved.</P>

    <H2>Your account</H2>
    <Ul items={[
      "Give accurate information, including your account type, and keep it up to date.",
      "Keep your password private. You're responsible for what happens under your account.",
      "Food banks: only register if you're a charity, non-profit or community program that distributes food, and give your real charitable registration number if you have one.",
    ]} />

    <H2>If you donate food</H2>
    <Ul items={[
      "Only post food that is safe to eat, and describe it honestly, including allergens, how it must be stored and when it was prepared.",
      <>Follow the <Link component={RouterLink} to="/food-safety">food safety guidance</Link> and your local health rules.</>,
      "Withdraw a posting if the food is no longer available or safe.",
    ]} />

    <H2>If you claim or deliver food</H2>
    <Ul items={[
      "Only claim or accept what you can collect during the pickup window. If you can't make it, release it as early as you can.",
      "Check food when you collect it, and don't accept or distribute anything that looks unsafe.",
      "Keep chilled, frozen and hot food at a safe temperature while you transport it.",
      "Drivers: only mark food collected or delivered when it really is, and don't ask for a handoff code before you have the food or are at the food bank. Restaurants and food banks: only give the code to the driver in person.",
      "Drivers are volunteers, not employees or contractors of Ladle. Drive safely and follow the law.",
    ]} />

    <H2>Being a good neighbour</H2>
    <Ul items={[
      "Be respectful in messages and ratings. Ratings should be honest and about the pickup.",
      "Don't use Ladle to sell food, advertise, harass anyone, or collect other people's information.",
      "We may remove content, or suspend or close accounts, that break these terms or put people at risk.",
    ]} />

    <H2>No guarantees</H2>
    <P>Ladle is provided as is. We work hard to keep it running and accurate, but we can&apos;t promise that food will be available, that a pickup or delivery will happen, or that information people post is correct. To the extent the law allows, Ladle isn&apos;t responsible for losses arising from donations, pickups or deliveries arranged through it.</P>

    <H2>Changes and contact</H2>
    <P>We may update these terms; the date above shows the latest version. Questions: <Contact />.</P>
  </LegalLayout>
);

export const FoodSafetyPage = () => (
  <LegalLayout title="Food safety and donor protection" intro="Practical guidance for donating, collecting and delivering surplus food safely, and an overview of the laws that protect good-faith donors in Canada.">
    <Alert severity="info" sx={{ mt: 3 }}>
      This page is general information, not legal advice. Laws differ by province and change over time. Check with your local
      public health unit and, for your organization&apos;s situation, a lawyer.
    </Alert>

    <H2>Before you post</H2>
    <Ul items={[
      "Only donate food you would serve to your own customers: properly handled, within its date, and not spoiled or contaminated.",
      "List allergens honestly, or choose \"None of these\" only if you're sure. When in doubt, say so in the notes.",
      "Say how the food must be kept (room temperature, refrigerated, frozen or hot) and when it was prepared.",
      "Pack food in clean, covered, food-grade containers, and label them with what's inside and the date.",
    ]} />

    <H2>Keeping food at safe temperatures</H2>
    <Ul items={[
      <>Keep cold food at <strong>4°C (40°F) or colder</strong>, and frozen food frozen.</>,
      <>Keep hot food at <strong>60°C (140°F) or hotter</strong>, or cool it quickly and refrigerate it.</>,
      <>Between 4°C and 60°C is the &quot;danger zone&quot;, where bacteria grow fastest. Limit how long food spends there, including during pickup and delivery.</>,
      "Drivers carrying chilled or frozen food should use a cooler. Ladle only alerts drivers who have one.",
    ]} />

    <H2>When you collect or deliver</H2>
    <Ul items={[
      "Check that containers are sealed and the food looks, smells and feels as expected. If not, don't take it.",
      "Go straight from the restaurant to the food bank, and get chilled or frozen food back into the fridge or freezer promptly.",
      "Food banks should follow their own food safety program and their local health rules.",
    ]} />

    <H2>Protection for good-faith donors</H2>
    <P>Almost every province and territory in Canada has a food donation law that protects people who donate or distribute food in good faith from liability for harm caused by the food. Examples include Alberta&apos;s <em>Charitable Donation of Food Act</em>, Ontario&apos;s <em>Donation of Food Act, 1994</em> and British Columbia&apos;s <em>Food Donor Encouragement Act</em>. Quebec relies on the general rule in article 1471 of the <em>Civil Code of Québec</em> rather than a separate act.</P>
    <P>These laws generally do <strong>not</strong> protect a donor or distributor who knew, or should have known, that the food was rotten, adulterated or otherwise unfit to eat, or who acted with reckless disregard for safety. Following the guidance above is the best way to stay within that protection.</P>
    <P>
      For more detail, see the{" "}
      <Link href="https://www.bccdc.ca/resource-gallery/Documents/Guidelines%20and%20Forms/Guidelines%20and%20Manuals/EH/FPS/Food/Food%20Donation%20Guidelines%20Complete.pdf" target="_blank" rel="noopener noreferrer">
        BC Centre for Disease Control&apos;s industry food donation guidelines
      </Link>{" "}
      and the{" "}
      <Link href="https://www.foodbanking.org/wp-content/uploads/2023/01/Canada-Legal-Guide.pdf" target="_blank" rel="noopener noreferrer">
        Global FoodBanking Network&apos;s Canada legal guide
      </Link>.
    </P>
  </LegalLayout>
);
