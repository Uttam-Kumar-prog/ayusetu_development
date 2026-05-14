const MedicineInventory = require('../models/MedicineInventory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.getMyInventory = asyncHandler(async (req, res) => {
  const inventory = await MedicineInventory.findOne({ pharmacyId: req.user._id });
  return res.json({ success: true, inventory: inventory || { pharmacyId: req.user._id, items: [] } });
});

exports.upsertInventoryItems = asyncHandler(async (req, res) => {
  const { items = [] } = req.body;

  if (!Array.isArray(items)) {
    throw new ApiError(400, 'items must be an array');
  }

  const normalized = items.map((item) => ({
    ...item,
    lastUpdatedAt: new Date(),
  }));

  const inventory = await MedicineInventory.findOneAndUpdate(
    { pharmacyId: req.user._id },
    {
      pharmacyId: req.user._id,
      items: normalized,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ success: true, message: 'Inventory updated', inventory });
});

exports.searchMedicines = asyncHandler(async (req, res) => {
  const { query = '' } = req.query;

  const pipelines = [
    { $unwind: '$items' },
    {
      $match: {
        'items.available': true,
        'items.name': { $regex: query, $options: 'i' },
      },
    },
    {
      $project: {
        pharmacyId: 1,
        medicine: '$items',
      },
    },
    { $limit: 50 },
  ];

  const results = await MedicineInventory.aggregate(pipelines);
  return res.json({ success: true, count: results.length, results });
});
