import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function ConsultationRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Access / appointment state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const [appt, setAppt] = useState(null);

  // Room / call state
  const [roomState, setRoomState] = useState(null); // from server
  const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | live | ended
  const [peerName, setPeerName] = useState('');
  const [peerPresent, setPeerPresent] = useState(false);
  const [connError, setConnError] = useState('');

  // Media state
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);

  // Toast
  const [toast, setToast] = useState('');

  // Refs
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const politeRef = useRef(false); // patient = polite, doctor = impolite

  const isDoctor = appt?.userRole === 'doctor';

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (msg, ms = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const stopTracks = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  };

  const closePeer = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // ── Step 1: Verify access ──────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const { data } = await appointmentsAPI.roomAccess(roomId);
        setAccess(data.access);
        setAppt(data.appointment);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load consultation details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  // ── Step 2: Connect socket & get media when access is granted ──────────────
  useEffect(() => {
    if (!access?.canJoinNow || !appt) return;

    politeRef.current = appt.userRole === 'patient';

    const token = localStorage.getItem('token');
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { roomId });
    });

    socket.on('connect_error', (err) => {
      setConnError('Could not connect to signaling server: ' + err.message);
    });

    socket.on('room-state', (state) => {
      setRoomState(state);
      const peer = appt.userRole === 'doctor' ? state.patientName : state.doctorName;
      setPeerName(peer || 'Other participant');
      const peerIn = appt.userRole === 'doctor' ? state.patientPresent : state.doctorPresent;
      setPeerPresent(peerIn);
      if (state.status === 'live') setCallStatus('live');
    });

    socket.on('peer-joined', ({ userName, role }) => {
      const isMyPeer = (appt.userRole === 'doctor' && role === 'patient') ||
                       (appt.userRole === 'patient' && role === 'doctor');
      if (isMyPeer) {
        setPeerPresent(true);
        setPeerName(userName);
        showToast(`${userName} has joined the room`);
      }
    });

    socket.on('peer-left', ({ userName }) => {
      showToast(`${userName} has left`);
      setPeerPresent(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on('call-started', ({ byUserName }) => {
      setCallStatus('live');
      showToast(`${byUserName} started the call`);
    });

    socket.on('call-ended', () => {
      showToast('Call has ended');
      setCallStatus('ended');
      closePeer();
      stopTracks();
    });

    socket.on('peer-media-state', ({ audio, video }) => {
      setPeerMicOn(audio);
      setPeerCamOn(video);
    });

    // ── WebRTC Perfect Negotiation ──────────────────────────────────────────
    socket.on('webrtc-offer', async ({ offer, fromUserName }) => {
      if (!pcRef.current) return;
      const pc = pcRef.current;
      const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
      ignoreOfferRef.current = !politeRef.current && offerCollision;
      if (ignoreOfferRef.current) return;
      try {
        await pc.setRemoteDescription(offer);
        await pc.setLocalDescription();
        socket.emit('webrtc-answer', { roomId, answer: pc.localDescription });
      } catch (e) {
        console.error('[WebRTC] offer handling error', e);
      }
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      if (!pcRef.current) return;
      try {
        if (pcRef.current.signalingState !== 'stable') {
          await pcRef.current.setRemoteDescription(answer);
        }
      } catch (e) {
        console.error('[WebRTC] answer error', e);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      if (!pcRef.current || !candidate) return;
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch (e) {
        if (!ignoreOfferRef.current) console.error('[WebRTC] ICE error', e);
      }
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    // Get user media
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCallStatus('idle'); // ready but not yet live
      } catch (e) {
        setConnError('Camera/microphone access denied. Please allow permissions and refresh.');
      }
    })();

    return () => {
      socket.disconnect();
      closePeer();
      stopTracks();
    };
  }, [access, appt, roomId, closePeer]);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Remote track → remote video
    pc.ontrack = ({ streams: [stream] }) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', { roomId, candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
        showToast('Connection lost. Trying to reconnect...');
      }
    };

    // Perfect negotiation
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        socketRef.current?.emit('webrtc-offer', { roomId, offer: pc.localDescription });
      } catch (e) {
        console.error('[WebRTC] negotiation error', e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [roomId]);

  // ── Start call (doctor action) ─────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    if (!isDoctor) return;
    try {
      await appointmentsAPI.startConsultation(appt.id);
      createPeerConnection();
      socketRef.current?.emit('call-started', { roomId });
      setCallStatus('live');
      showToast('Consultation started. Patient has been notified.');
    } catch (e) {
      showToast('Failed to start consultation: ' + (e?.response?.data?.message || e.message));
    }
  }, [isDoctor, appt, roomId, createPeerConnection]);

  // ── Join call (patient action) ────────────────────────────────────────────
  const handleJoinCall = useCallback(() => {
    createPeerConnection();
    setCallStatus('live');
    showToast('You have joined the consultation');
  }, [createPeerConnection]);

  // ── Toggle mic ────────────────────────────────────────────────────────────
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    const newState = !micOn;
    setMicOn(newState);
    socketRef.current?.emit('media-state-changed', { roomId, audio: newState, video: camOn });
  };

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    const newState = !camOn;
    setCamOn(newState);
    socketRef.current?.emit('media-state-changed', { roomId, audio: micOn, video: newState });
  };

  // ── End call ──────────────────────────────────────────────────────────────
  const handleEndCall = () => {
    socketRef.current?.emit('call-ended', { roomId });
    setCallStatus('ended');
    closePeer();
    stopTracks();
  };

  // ─────────────────────────── RENDER ───────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Preparing consultation room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-28 px-6 bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Room Unavailable</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl">Patient Dashboard</Link>
            <Link to="/doctor-dashboard" className="px-5 py-2.5 bg-slate-700 text-white font-bold rounded-xl">Doctor Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!access?.canJoinNow) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 bg-slate-50 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Room Not Open Yet</h1>
          <p className="text-slate-600 mb-6">{access?.reason || 'Meeting not available right now.'}</p>
          <div className="grid grid-cols-2 gap-4 mb-6 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Opens At</p>
              <p className="text-slate-800 font-semibold text-sm">
                {access?.windowStart ? new Date(access.windowStart).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Closes At</p>
              <p className="text-slate-800 font-semibold text-sm">
                {access?.windowEnd ? new Date(access.windowEnd).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
          {appt && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-green-800">📅 {appt.slotDate} at {appt.slotTime}</p>
              <p className="text-sm text-green-700">{isDoctor ? `Patient: ${appt.patientName}` : `Doctor: Dr. ${appt.doctorName}`}</p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm">My Dashboard</Link>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50">Refresh</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active room ────────────────────────────────────────────────────────────
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Consultation Ended</h2>
          <p className="text-slate-500 mb-6">Thank you for using IU Setu. Take care and stay healthy.</p>
          <div className="flex gap-3 justify-center">
            {isDoctor
              ? <Link to="/doctor-dashboard" className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl">Back to Dashboard</Link>
              : <Link to="/dashboard" className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl">Back to Dashboard</Link>
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pt-16 pb-4 px-3 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-semibold text-sm animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Header bar */}
      <div className="mb-3 bg-white/10 border border-white/15 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2.5 h-2.5 rounded-full ${callStatus === 'live' ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {callStatus === 'live' ? 'Live' : 'Waiting'}
            </span>
          </div>
          <h1 className="text-lg font-bold">
            {isDoctor ? `Patient: ${appt?.patientName || 'Patient'}` : `Dr. ${appt?.doctorName || 'Doctor'}`}
          </h1>
          <p className="text-xs text-slate-400">{appt?.slotDate} at {appt?.slotTime}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {peerPresent
            ? <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold">● {peerName} is here</span>
            : <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold">⏳ Waiting for {peerName || 'other participant'}...</span>
          }
        </div>
      </div>

      {/* Connection error */}
      {connError && (
        <div className="mb-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl px-4 py-3 text-sm">
          ⚠️ {connError}
        </div>
      )}

      {/* Video grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
        {/* Remote video */}
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10 min-h-[240px]">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {(!peerPresent || callStatus !== 'live') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-4xl mb-3">
                {isDoctor ? '🧑' : '👨‍⚕️'}
              </div>
              <p className="text-sm font-semibold">{peerName || (isDoctor ? 'Patient' : 'Doctor')}</p>
              <p className="text-xs text-slate-500 mt-1">{callStatus === 'live' ? 'Video loading...' : 'Not joined yet'}</p>
            </div>
          )}
          {!peerCamOn && peerPresent && callStatus === 'live' && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400">
              <p className="text-sm font-semibold">📵 Camera off</p>
            </div>
          )}
          {!peerMicOn && peerPresent && (
            <div className="absolute top-3 right-3 bg-rose-600/90 text-white text-xs px-2 py-1 rounded-lg">🔇 Muted</div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
            {peerName || (isDoctor ? 'Patient' : 'Doctor')}
          </div>
        </div>

        {/* Local video */}
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10 min-h-[240px]">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!camOn && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400">
              <p className="text-sm font-semibold">📵 Your camera is off</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
            You ({isDoctor ? 'Doctor' : 'Patient'})
          </div>
          {!micOn && <div className="absolute top-3 right-3 bg-rose-600/90 text-white text-xs px-2 py-1 rounded-lg">🔇 Muted</div>}
        </div>
      </div>

      {/* Controls bar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {/* Mic */}
        <button
          onClick={toggleMic}
          className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
            micOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-rose-600 text-white'
          }`}
        >
          <span className="text-xl">{micOn ? '🎤' : '🔇'}</span>
          <span className="text-xs">{micOn ? 'Mute' : 'Unmute'}</span>
        </button>

        {/* Camera */}
        <button
          onClick={toggleCam}
          className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${
            camOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-rose-600 text-white'
          }`}
        >
          <span className="text-xl">{camOn ? '📹' : '📵'}</span>
          <span className="text-xs">{camOn ? 'Stop Video' : 'Start Video'}</span>
        </button>

        {/* Doctor: Start Call / Patient: Join Call */}
        {callStatus !== 'live' && (
          isDoctor ? (
            <button
              onClick={handleStartCall}
              className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm transition-all shadow-lg shadow-green-500/30"
            >
              <span className="text-xl">▶️</span>
              <span className="text-xs">Start Call</span>
            </button>
          ) : (
            <button
              onClick={handleJoinCall}
              className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/30"
            >
              <span className="text-xl">📞</span>
              <span className="text-xs">Join Call</span>
            </button>
          )
        )}

        {/* End call */}
        <button
          onClick={handleEndCall}
          className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/30"
        >
          <span className="text-xl">📵</span>
          <span className="text-xs">End Call</span>
        </button>

        {/* Dashboard link */}
        <Link
          to={isDoctor ? '/doctor-dashboard' : '/dashboard'}
          className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 font-bold text-sm transition-all"
        >
          <span className="text-xl">🏠</span>
          <span className="text-xs">Dashboard</span>
        </Link>
      </div>

      {/* Waiting room hint */}
      {callStatus !== 'live' && (
        <p className="text-center text-slate-500 text-xs mt-3">
          {isDoctor
            ? 'Click "Start Call" to begin the consultation and notify the patient.'
            : 'Waiting for the doctor to start the call. You will be notified by email when the doctor is ready.'}
        </p>
      )}
    </div>
  );
}
