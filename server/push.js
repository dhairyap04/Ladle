// Web push for the installed app (and any browser that allows it). Off unless
// VAPID keys are configured; generate them with `npm run vapid`.
const webpush = require("web-push");
const mongoPushSubscriptions = require("./models/PushSubscriptions");
const { vapidPublicKey, vapidPrivateKey, vapidSubject } = require("./config");

const enabled = Boolean(vapidPublicKey && vapidPrivateKey);
if (enabled) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

let sender = (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 6 * 3600 });
let replaced = false;

// Tests swap in a fake sender, which also turns push on without keys.
function setSender(fn) {
  sender = fn;
  replaced = true;
}

const pushEnabled = () => enabled || replaced;

// Sends { title, body, link } to every device the users subscribed. Dead
// subscriptions (the browser unsubscribed or expired them) are removed.
async function sendPush(userIds, { title, body, link }) {
  if (!pushEnabled()) return;
  const subs = await mongoPushSubscriptions.find({ userId: { $in: userIds } });
  const payload = JSON.stringify({ title, body, link });
  await Promise.all(
    subs.map((sub) =>
      sender({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, payload).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) await sub.deleteOne();
        else console.error("Push failed:", err.statusCode || err.message);
      })
    )
  );
}

module.exports = { sendPush, setSender, pushEnabled, publicKey: () => vapidPublicKey };
