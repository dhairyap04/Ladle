// Prints a new VAPID key pair for web push. Put them in server/.env:
//   VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:you@example.com
// Keep the private key secret. Changing keys means every device has to turn
// push notifications on again.
const webpush = require("web-push");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
