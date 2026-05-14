const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String, default: '' },
    strength: { type: String, default: '' },
    available: { type: Boolean, default: true },
    quantity: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const medicineInventorySchema = new mongoose.Schema(
  {
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [inventoryItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicineInventory', medicineInventorySchema);
