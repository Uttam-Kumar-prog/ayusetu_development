import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appointmentsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const SIGNAL_POLL_MS = 1200;
const HEARTBEAT_MS = 5000;

export default function ConsultationRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const [appt, setAppt] = useState(null);

  const [roomState, setRoomState] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [peerName, setPeerName] = useState('');
  const [peerPresent, setPeerPresent] = useState(false);
  const [connError, setConnError] = useState('');

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerMicOn, setPeerMicOn] = useState(true);
  const [peerCamOn, setPeerCamOn] = useState(true);

  const [toast, setToast] = useState('');

  const pollTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const lastSignalAtRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingWebrtcSignalsRef = useRef([]);
  const processSignalRef = useRef(null);
  const politeRef = useRef(false);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);

  const isDoctor = appt?.userRole === 'doctor';
  const myUserId = String(user?._id || user?.id || '');

  const showToast = (msg, ms = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const stopTracks = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
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

  const publishSignal = useCallback(async (type, payload = {}) => {
    if (!roomId) return;
    try {
      await appointmentsAPI.publishRoomSignal(roomId, { type, payload });
    } catch (signalError) {
      const message = signalError?.response?.data?.message || signalError?.message || 'Signal send failed';
      setConnError(`Could not connect to signaling server: ${message}`);
    }
  }, [roomId]);

  const attachLocalTracks = useCallback((pc) => {
    if (!pc || !localStreamRef.current) return;

    const senderTrackIds = new Set(
      pc.getSenders().map((sender) => sender.track?.id).filter(Boolean)
    );

    localStreamRef.current.getTracks().forEach((track) => {
      if (!senderTrackIds.has(track.id)) {
        pc.addTrack(track, localStreamRef.current);
      }
    });
  }, []);

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

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    attachLocalTracks(pc);

    pc.ontrack = ({ streams: [stream] }) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        publishSignal('webrtc-ice-candidate', { candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
        showToast('Connection unstable. Retrying...');
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        await publishSignal('webrtc-offer', { offer: pc.localDescription });
      } catch (offerError) {
        console.error('[WebRTC] negotiation error', offerError);
      } finally {
        makingOfferRef.current = false;
      }
    };

    setTimeout(async () => {
      const queued = [...pendingWebrtcSignalsRef.current];
      pendingWebrtcSignalsRef.current = [];
      for (const signal of queued) {
        if (processSignalRef.current) {
          await processSignalRef.current(signal);
        }
      }
    }, 0);

    return pc;
  }, [attachLocalTracks, publishSignal]);

  const processSignal = useCallback(async (signal) => {
    if (!signal || signal.fromUserId === myUserId) return;

    const isMyPeer = (appt?.userRole === 'doctor' && signal.fromRole === 'patient')
      || (appt?.userRole === 'patient' && signal.fromRole === 'doctor');
    if (!isMyPeer) return;

    if (signal.type === 'peer-joined') {
      setPeerPresent(true);
      if (signal.fromUserName) setPeerName(signal.fromUserName);
      showToast(`${signal.fromUserName || 'Participant'} has joined the room`);
      return;
    }

    if (signal.type === 'peer-left') {
      setPeerPresent(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      showToast(`${signal.fromUserName || 'Participant'} has left`);
      return;
    }

    if (signal.type === 'presence-heartbeat') {
      setPeerPresent(true);
      if (signal.fromUserName) setPeerName(signal.fromUserName);
      if (typeof signal?.payload?.audio === 'boolean') setPeerMicOn(signal.payload.audio);
      if (typeof signal?.payload?.video === 'boolean') setPeerCamOn(signal.payload.video);
      return;
    }

    if (signal.type === 'call-started') {
      setCallStatus('live');
      createPeerConnection();
      showToast(`${signal.fromUserName || 'Doctor'} started the call`);
      return;
    }

    if (signal.type === 'call-ended') {
      setCallStatus('ended');
      showToast('Call has ended');
      closePeer();
      stopTracks();
      return;
    }

    if (signal.type === 'media-state-changed') {
      if (typeof signal?.payload?.audio === 'boolean') setPeerMicOn(signal.payload.audio);
      if (typeof signal?.payload?.video === 'boolean') setPeerCamOn(signal.payload.video);
      return;
    }

    if (signal.type === 'webrtc-offer') {
      const pc = pcRef.current || createPeerConnection();
      const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
      ignoreOfferRef.current = !politeRef.current && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        await pc.setRemoteDescription(signal.payload.offer);
        await pc.setLocalDescription();
        await publishSignal('webrtc-answer', { answer: pc.localDescription });
      } catch (offerError) {
        console.error('[WebRTC] offer handling error', offerError);
      }
      return;
    }

    if (signal.type === 'webrtc-answer') {
      if (!pcRef.current) {
        pendingWebrtcSignalsRef.current.push(signal);
        return;
      }
      try {
        if (pcRef.current.signalingState !== 'stable') {
          await pcRef.current.setRemoteDescription(signal.payload.answer);
        }
      } catch (answerError) {
        console.error('[WebRTC] answer error', answerError);
      }
      return;
    }

    if (signal.type === 'webrtc-ice-candidate') {
      if (!signal?.payload?.candidate) return;
      if (!pcRef.current) {
        pendingWebrtcSignalsRef.current.push(signal);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(signal.payload.candidate);
      } catch (iceError) {
        if (!ignoreOfferRef.current) console.error('[WebRTC] ICE error', iceError);
      }
    }
  }, [appt?.userRole, closePeer, createPeerConnection, myUserId, publishSignal]);

  useEffect(() => {
    processSignalRef.current = processSignal;
  }, [processSignal]);

  useEffect(() => {
    if (!access?.canJoinNow || !appt) return;

    politeRef.current = appt.userRole === 'patient';
    setPeerName(appt.userRole === 'doctor' ? appt.patientName : appt.doctorName);
    setRoomState({ status: appt.status === 'IN_PROGRESS' ? 'live' : 'waiting' });
    setConnError('');

    const fetchSignals = async () => {
      try {
        const { data } = await appointmentsAPI.roomSignals(roomId, {
          after: lastSignalAtRef.current || undefined,
          limit: 120,
        });
        const signals = data?.signals || [];
        for (const signal of signals) {
          await processSignal(signal);
        }
        if (signals.length > 0) {
          lastSignalAtRef.current = signals[signals.length - 1].createdAt;
        }
      } catch (pollError) {
        setConnError(pollError?.response?.data?.message || 'Could not connect to signaling server: polling error');
      }
    };

    pollTimerRef.current = setInterval(fetchSignals, SIGNAL_POLL_MS);
    heartbeatTimerRef.current = setInterval(() => {
      publishSignal('presence-heartbeat', { audio: micOnRef.current, video: camOnRef.current });
    }, HEARTBEAT_MS);

    fetchSignals();
    publishSignal('peer-joined');
    publishSignal('presence-heartbeat', { audio: micOnRef.current, video: camOnRef.current });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        attachLocalTracks(pcRef.current);
        setCallStatus((current) => (current === 'live' ? current : 'idle'));
      } catch {
        setConnError('Camera/microphone access denied. Please allow permissions and refresh.');
      }
    })();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      publishSignal('peer-left');
      closePeer();
      stopTracks();
    };
  }, [access, appt, roomId, processSignal, publishSignal, closePeer, attachLocalTracks]);

  const handleStartCall = useCallback(async () => {
    if (!isDoctor) return;
    try {
      await appointmentsAPI.startConsultation(appt.id);
      createPeerConnection();
      await publishSignal('call-started');
      setCallStatus('live');
      showToast('Consultation started. Patient has been notified.');
    } catch (startError) {
      showToast(`Failed to start consultation: ${startError?.response?.data?.message || startError?.message}`);
    }
  }, [isDoctor, appt, createPeerConnection, publishSignal]);

  const handleJoinCall = useCallback(async () => {
    createPeerConnection();
    setCallStatus('live');
    showToast('You have joined the consultation');
  }, [createPeerConnection]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newState = !micOn;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = newState;
    });

    micOnRef.current = newState;
    setMicOn(newState);
    publishSignal('media-state-changed', { audio: newState, video: camOnRef.current });
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newState = !camOn;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = newState;
    });

    camOnRef.current = newState;
    setCamOn(newState);
    publishSignal('media-state-changed', { audio: micOnRef.current, video: newState });
  };

  const handleEndCall = async () => {
    await publishSignal('call-ended');
    setCallStatus('ended');
    closePeer();
    stopTracks();
  };

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
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Room Not Open Yet</h1>
          <p className="text-slate-600 mb-6">{access?.reason || 'Meeting not available right now.'}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm">My Dashboard</Link>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50">Refresh</button>
          </div>
        </div>
      </div>
    );
  }

  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Consultation Ended</h2>
          <p className="text-slate-500 mb-6">Thank you for using AyuSetu.</p>
          {isDoctor
            ? <Link to="/doctor-dashboard" className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl">Back to Dashboard</Link>
            : <Link to="/dashboard" className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl">Back to Dashboard</Link>
          }
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pt-16 pb-4 px-3 flex flex-col">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-semibold text-sm">
          {toast}
        </div>
      )}

      <div className="mb-3 bg-white/10 border border-white/15 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2.5 h-2.5 rounded-full ${callStatus === 'live' ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{callStatus === 'live' ? 'Live' : 'Waiting'}</span>
          </div>
          <h1 className="text-lg font-bold">{isDoctor ? `Patient: ${appt?.patientName || 'Patient'}` : `Dr. ${appt?.doctorName || 'Doctor'}`}</h1>
          <p className="text-xs text-slate-400">{appt?.slotDate} at {appt?.slotTime}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {peerPresent
            ? <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold">Participant connected</span>
            : <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold">Waiting for {peerName || 'participant'}...</span>
          }
        </div>
      </div>

      {connError && (
        <div className="mb-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl px-4 py-3 text-sm">
          {connError}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10 min-h-[240px]">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {(!peerPresent || callStatus !== 'live') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <p className="text-sm font-semibold">{peerName || (isDoctor ? 'Patient' : 'Doctor')}</p>
              <p className="text-xs text-slate-500 mt-1">{callStatus === 'live' ? 'Video loading...' : 'Not joined yet'}</p>
            </div>
          )}
          {!peerCamOn && peerPresent && callStatus === 'live' && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400">
              <p className="text-sm font-semibold">Camera off</p>
            </div>
          )}
          {!peerMicOn && peerPresent && (
            <div className="absolute top-3 right-3 bg-rose-600/90 text-white text-xs px-2 py-1 rounded-lg">Muted</div>
          )}
        </div>

        <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10 min-h-[240px]">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!camOn && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400">
              <p className="text-sm font-semibold">Your camera is off</p>
            </div>
          )}
          {!micOn && <div className="absolute top-3 right-3 bg-rose-600/90 text-white text-xs px-2 py-1 rounded-lg">Muted</div>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button onClick={toggleMic} className={`px-5 py-3 rounded-2xl font-bold text-sm ${micOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-rose-600 text-white'}`}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>

        <button onClick={toggleCam} className={`px-5 py-3 rounded-2xl font-bold text-sm ${camOn ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-rose-600 text-white'}`}>
          {camOn ? 'Stop Video' : 'Start Video'}
        </button>

        {callStatus !== 'live' && (isDoctor
          ? <button onClick={handleStartCall} className="px-6 py-3 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm">Start Call</button>
          : <button onClick={handleJoinCall} className="px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm">Join Call</button>
        )}

        <button onClick={handleEndCall} className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm">End Call</button>

        <Link to={isDoctor ? '/doctor-dashboard' : '/dashboard'} className="px-5 py-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 font-bold text-sm">
          Dashboard
        </Link>
      </div>

      {callStatus !== 'live' && (
        <p className="text-center text-slate-500 text-xs mt-3">
          {isDoctor
            ? 'Click Start Call to begin consultation.'
            : 'Waiting for doctor to start the call.'}
        </p>
      )}

      {roomState?.status === 'live' && callStatus !== 'live' && (
        <p className="text-center text-emerald-400 text-xs mt-1">Call is live. You can join now.</p>
      )}
    </div>
  );
}
