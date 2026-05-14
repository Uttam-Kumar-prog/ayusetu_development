const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');
const DoctorAvailability = require('./models/DoctorAvailability');
const roles = require('./constants/roles');
const { SLOT } = require('./constants/statuses');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const doctors = [
  {
    fullName: 'Dr. Aarav Sharma',
    email: 'aarav.sharma@ayusetu.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Kayachikitsa (General Medicine)',
      experienceYears: 15,
      qualifications: ['BAMS', 'MD (Ayurveda)'],
      languages: ['English', 'Hindi', 'Punjabi'],
      consultationFee: 500,
      location: 'Delhi, India',
      bio: 'Expert in managing chronic lifestyle disorders through traditional Ayurvedic principles and modern diagnostics.',
      rating: 4.8,
      verifiedByAdmin: true
    }
  },
  {
    fullName: 'Dr. Ishita Verma',
    email: 'ishita.verma@ayusetu.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Shalya Tantra (Surgery & Para-surgery)',
      experienceYears: 10,
      qualifications: ['BAMS', 'MS (Ayurveda)'],
      languages: ['English', 'Hindi'],
      consultationFee: 600,
      location: 'Mumbai, India',
      bio: 'Specialist in Kshara Sutra therapy for anorectal disorders and traditional wound management.',
      rating: 4.7,
      verifiedByAdmin: true
    }
  },
  {
    fullName: 'Dr. Vikram Malhotra',
    email: 'vikram.malhotra@ayusetu.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Panchakarma (Detoxification)',
      experienceYears: 12,
      qualifications: ['BAMS', 'PG Diploma in Panchakarma'],
      languages: ['English', 'Hindi', 'Malayalam'],
      consultationFee: 450,
      location: 'Bangalore, India',
      bio: 'Focused on holistic detoxification and rejuvenation therapies to restore body balance.',
      rating: 4.9,
      verifiedByAdmin: true
    }
  },
  {
    fullName: 'Dr. Ananya Iyer',
    email: 'ananya.iyer@ayusetu.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Prasuti & Stri Roga (Gynecology)',
      experienceYears: 8,
      qualifications: ['BAMS', 'MD (Ayurveda)'],
      languages: ['English', 'Tamil', 'Hindi'],
      consultationFee: 550,
      location: 'Chennai, India',
      bio: 'Dedicated to women\'s health, prenatal care, and postnatal recovery using Ayurvedic herbs.',
      rating: 4.6,
      verifiedByAdmin: true
    }
  },
  {
    fullName: 'Dr. Rohan Deshmukh',
    email: 'rohan.deshmukh@ayusetu.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Kaumarbhritya (Pediatrics)',
      experienceYears: 7,
      qualifications: ['BAMS'],
      languages: ['English', 'Marathi', 'Hindi'],
      consultationFee: 400,
      location: 'Pune, India',
      bio: 'Specializing in child growth, immunity, and developmental health through natural Ayurveda.',
      rating: 4.5,
      verifiedByAdmin: true
    }
  },,
  {
    fullName: 'Rohit Kumar',
    email: 'rohitkumar95251159@gmail.com',
    password: 'password123',
    role: roles.DOCTOR || 'doctor',
    isVerified: true,
    doctorProfile: {
      specialty: 'Kaumarbhritya (Pediatrics)',
      experienceYears: 7,
      qualifications: ['BAMS'],
      languages: ['English', 'Marathi', 'Hindi'],
      consultationFee: 400,
      location: 'Pune, India',
      bio: 'Specializing in child growth, immunity, and developmental health through natural Ayurveda.',
      rating: 4.5,
      verifiedByAdmin: true
    }
  }
];

const generateSlots = (dateStr) => {
  const slots = [];
  const times = ['07:30','7:40','7:50', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  times.forEach(time => {
    const [hours, minutes] = time.split(':');
    const startAt = new Date(dateStr);
    startAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const endAt = new Date(startAt);
    endAt.setHours(startAt.getHours() + 1);

    slots.push({
      time,
      startAt,
      endAt,
      status: SLOT.AVAILABLE
    });
  });

  return slots;
};

const seedData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Remove existing doctors to avoid duplicates during seed
    console.log('Cleaning existing doctors and availability...');
    const doctorNodes = await User.find({ role: roles.DOCTOR || 'doctor' });
    const doctorIds = doctorNodes.map(d => d._id);

    await DoctorAvailability.deleteMany({ doctorId: { $in: doctorIds } });
    await User.deleteMany({ role: roles.DOCTOR || 'doctor' });

    console.log('Seeding doctors...');
    const createdDoctors = await User.create(doctors);
    console.log(`Created ${createdDoctors.length} doctors.`);

    console.log('Seeding availability slots for next 7 days...');
    const availabilityData = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      createdDoctors.forEach(doc => {
        availabilityData.push({
          doctorId: doc._id,
          date: dateStr,
          timezone: 'Asia/Kolkata',
          slots: generateSlots(dateStr)
        });
      });
    }

    await DoctorAvailability.insertMany(availabilityData);
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();

