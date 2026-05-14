const Notification = require('../models/Notification');

const createNotification = async ({ userId, type, title, body, channel = 'IN_APP', payload = {} }) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    body,
    channel,
    payload,
    status: 'SENT',
    sentAt: new Date(),
  });
  return notification;
};

module.exports = {
  createNotification,
};
