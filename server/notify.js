// Creates in-app notifications and, when SMTP is configured, emails them too.
// Failures are logged and never fail the request that triggered them.
const nodemailer = require("nodemailer");
const mongoNotifications = require("./models/Notifications");
const mongoUsers = require("./models/Users");
const { smtpUrl, emailFrom, clientOrigins } = require("./config");

let transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : null;

// Tests can capture emails instead of sending them.
function setTransport(t) {
  transport = t;
}

const appUrl = (link) => `${clientOrigins[0].replace(/\/$/, "")}${link}`;

async function sendEmails(users, { title, body, link }) {
  if (!transport) return;
  await Promise.all(
    users
      .filter((u) => u.email && u.notifyByEmail !== false)
      .map((u) =>
        transport
          .sendMail({
            from: emailFrom,
            to: u.email,
            subject: `MealDrop: ${title}`,
            text: `${body}\n\n${link ? `Open MealDrop: ${appUrl(link)}\n\n` : ""}You can turn off email alerts on your MealDrop profile.`,
          })
          .catch((err) => console.error(`Email to user ${u._id} failed:`, err.message))
      )
  );
}

// notify(userIds, { type, title, body, link, postingId })
async function notify(userIds, message) {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return;
  try {
    await mongoNotifications.insertMany(ids.map((userId) => ({ ...message, userId })));
    const users = await mongoUsers.find({ _id: { $in: ids } }, "email notifyByEmail");
    await sendEmails(users, message);
  } catch (err) {
    console.error("Notification failed:", err.message);
  }
}

module.exports = { notify, setTransport };
