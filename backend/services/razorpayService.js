const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const getConfig = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
};

const isRazorpayEnabled = () => {
  const { keyId, keySecret } = getConfig();
  return Boolean(keyId && keySecret);
};

const assertEnabled = () => {
  if (!isRazorpayEnabled()) {
    throw new ApiError(503, 'Payment gateway is not configured. Please try again later.');
  }
};

const createOrder = async ({ amountPaise, currency = 'INR', receipt, notes = {} }) => {
  assertEnabled();
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, 'Invalid payment amount.');
  }

  const { keyId, keySecret } = getConfig();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      payment_capture: 1,
      notes,
    }),
  });

  if (!response.ok) {
    let errorBody = {};
    try {
      errorBody = await response.json();
    } catch {}
    throw new ApiError(502, errorBody?.error?.description || 'Could not create payment order.');
  }

  return response.json();
};

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const { keySecret } = getConfig();
  if (!keySecret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  return expected === signature;
};

module.exports = {
  isRazorpayEnabled,
  createOrder,
  verifyPaymentSignature,
};
