const express = require('express');
const { body, query } = require('express-validator');
const {
  getMyInventory,
  upsertInventoryItems,
  searchMedicines,
} = require('../controllers/pharmacyController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/inventory', protect, authorize('pharmacy', 'admin'), getMyInventory);
router.put(
  '/inventory',
  protect,
  authorize('pharmacy', 'admin'),
  body('items').isArray().withMessage('items must be an array'),
  body('items.*.name').isString().trim().notEmpty().withMessage('item name is required'),
  body('items.*.genericName').optional().isString().withMessage('genericName must be a string'),
  body('items.*.strength').optional().isString().withMessage('strength must be a string'),
  body('items.*.available').optional().isBoolean().withMessage('available must be true or false'),
  body('items.*.quantity').optional().isInt({ min: 0 }).withMessage('quantity must be at least 0'),
  validate,
  upsertInventoryItems
);
router.get(
  '/search',
  protect,
  authorize('patient', 'doctor', 'admin', 'pharmacy'),
  query('query').optional().isString().isLength({ max: 100 }).withMessage('query must be under 100 characters'),
  validate,
  searchMedicines
);

module.exports = router;
