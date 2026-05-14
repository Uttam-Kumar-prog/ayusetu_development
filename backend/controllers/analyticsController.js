const User = require('../models/User');
const SymptomHistory = require('../models/SymptomHistory');
const Appointment = require('../models/Appointment');
const TherapyPlan = require('../models/TherapyPlan');
const asyncHandler = require('../utils/asyncHandler');

exports.getTrends = asyncHandler(async (req, res) => {
  const trends = await SymptomHistory.aggregate([
    { $unwind: '$symptoms' },
    { $group: { _id: '$symptoms.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  return res.json({ success: true, trends });
});

exports.getDistrictSymptomTrends = asyncHandler(async (req, res) => {
  const trends = await SymptomHistory.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $unwind: '$symptoms' },
    {
      $group: {
        _id: {
          district: { $ifNull: ['$user.profile.district', 'Unknown'] },
          symptom: '$symptoms.name',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  return res.json({ success: true, trends });
});

exports.getDashboardMetrics = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalPatients,
    totalDoctors,
    pendingDoctorVerifications,
    totalAppointments,
    totalAssessments,
    activeTherapyPlans,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'doctor' }),
    User.countDocuments({ role: 'doctor', 'doctorProfile.verifiedByAdmin': false }),
    Appointment.countDocuments({}),
    SymptomHistory.countDocuments({}),
    TherapyPlan.countDocuments({ status: 'ACTIVE' }),
  ]);

  return res.json({
    success: true,
    metrics: {
      totalUsers,
      totalPatients,
      totalDoctors,
      pendingDoctorVerifications,
      totalAppointments,
      totalAssessments,
      activeTherapyPlans,
    },
  });
});
