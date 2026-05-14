const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

// roomId -> { doctorSocketId, patientSocketId, doctorName, patientName, status }
const rooms = new Map();

function setupSignaling(io) {
  // Auth middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found'));
      socket.userId   = String(user._id);
      socket.userRole = user.role;
      socket.userName = user.fullName;
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.userName} [${socket.id}]`);

    socket.on('join-room', async ({ roomId }) => {
      try {
        const appt = await Appointment.findOne({ 'meeting.roomId': roomId })
          .populate('patientId', 'fullName')
          .populate('doctorId',  'fullName');

        if (!appt) { socket.emit('error', { message: 'Room not found' }); return; }

        const isDoc = String(appt.doctorId?._id  || appt.doctorId)  === socket.userId;
        const isPat = String(appt.patientId?._id || appt.patientId) === socket.userId;
        const isAdm = socket.userRole === 'admin';

        if (!isDoc && !isPat && !isAdm) {
          socket.emit('error', { message: 'Not authorized for this room' });
          return;
        }

        socket.join(roomId);
        socket.roomId   = roomId;
        socket.isDoctor = isDoc;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, { doctorSocketId: null, patientSocketId: null, status: 'waiting',
            doctorName: appt.doctorId?.fullName  || 'Doctor',
            patientName: appt.patientId?.fullName || 'Patient' });
        }
        const room = rooms.get(roomId);
        if (isDoc) { room.doctorSocketId = socket.id; room.doctorName = socket.userName; }
        else if (isPat) { room.patientSocketId = socket.id; room.patientName = socket.userName; }

        if (room.doctorSocketId && room.patientSocketId) room.status = 'live';

        // Notify others
        socket.to(roomId).emit('peer-joined', { userId: socket.userId, userName: socket.userName,
          role: isDoc ? 'doctor' : 'patient' });

        // Send state to joiner
        socket.emit('room-state', {
          roomId, status: room.status,
          doctorPresent:  !!room.doctorSocketId,
          patientPresent: !!room.patientSocketId,
          doctorName:  room.doctorName,
          patientName: room.patientName,
          appointment: { slotDate: appt.slotDate, slotTime: appt.slotTime,
            consultationType: appt.consultationType },
        });
      } catch (err) {
        console.error('[Socket] join-room error:', err.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // WebRTC signaling passthrough
    socket.on('webrtc-offer',         ({ roomId, offer })      => socket.to(roomId).emit('webrtc-offer',         { offer,     fromUserId: socket.userId, fromUserName: socket.userName }));
    socket.on('webrtc-answer',        ({ roomId, answer })     => socket.to(roomId).emit('webrtc-answer',        { answer,    fromUserId: socket.userId }));
    socket.on('webrtc-ice-candidate', ({ roomId, candidate })  => socket.to(roomId).emit('webrtc-ice-candidate', { candidate, fromUserId: socket.userId }));

    socket.on('call-started', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) room.status = 'live';
      socket.to(roomId).emit('call-started', { byUserId: socket.userId, byUserName: socket.userName });
    });

    socket.on('call-ended', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) room.status = 'ended';
      io.to(roomId).emit('call-ended', { byUserId: socket.userId, byUserName: socket.userName });
    });

    socket.on('media-state-changed', ({ roomId, audio, video }) => {
      socket.to(roomId).emit('peer-media-state', { userId: socket.userId, audio, video });
    });

    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        if (room.doctorSocketId  === socket.id) { room.doctorSocketId  = null; room.status = 'waiting'; }
        if (room.patientSocketId === socket.id)   room.patientSocketId = null;
        socket.to(roomId).emit('peer-left', { userId: socket.userId, userName: socket.userName,
          role: socket.isDoctor ? 'doctor' : 'patient' });
        if (!room.doctorSocketId && !room.patientSocketId) rooms.delete(roomId);
      }
      console.log(`[Socket] Disconnected: ${socket.userName} [${socket.id}]`);
    });
  });
}

module.exports = { setupSignaling };
