import React, { useEffect, useMemo, useState } from 'react';
import { doctorsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const slotOptions = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ManageAvailabilityModal({ onClose, doctorId: doctorIdProp }) {
  const { user } = useAuth();
  const doctorId = doctorIdProp || user?._id || user?.id || '';

  const [date, setDate] = useState(toDateValue(new Date()));
  const [slots, setSlots] = useState([]);
  const [customTime, setCustomTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!doctorId) return;

    const fetchSlots = async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const { data } = await doctorsAPI.getAvailability(doctorId, { date });
        const firstEntry = (data?.availability || [])[0];
        const openSlots = (firstEntry?.slots || [])
          .filter((slot) => slot?.status === 'AVAILABLE' && slot?.time)
          .map((slot) => slot.time)
          .sort((a, b) => a.localeCompare(b));
        setSlots(openSlots);
      } catch (apiError) {
        setSlots([]);
        setError(apiError?.response?.data?.message || 'Could not load availability for this date.');
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [date, doctorId]);

  const selectedSet = useMemo(() => new Set(slots), [slots]);

  const toggleSlot = (time) => {
    setSuccess('');
    setError('');
    setSlots((previous) => (
      previous.includes(time)
        ? previous.filter((item) => item !== time)
        : [...previous, time].sort((a, b) => a.localeCompare(b))
    ));
  };

  const addCustomSlot = () => {
    const normalized = String(customTime || '').trim().slice(0, 5);
    if (!timeFormatRegex.test(normalized)) {
      setError('Please select a valid time in HH:mm format.');
      setSuccess('');
      return;
    }

    if (selectedSet.has(normalized)) {
      setError('That time is already selected.');
      setSuccess('');
      return;
    }

    setError('');
    setSuccess('');
    setSlots((previous) => [...previous, normalized].sort((a, b) => a.localeCompare(b)));
    setCustomTime('');
  };

  const removeSelectedSlot = (time) => {
    setSuccess('');
    setError('');
    setSlots((previous) => previous.filter((item) => item !== time));
  };

  const handleSave = async () => {
    if (!date) return;
    if (slots.length === 0) {
      setError('Please select at least one slot before saving.');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await doctorsAPI.updateMyAvailability({
        date,
        slots: slots.map((time) => ({ time })),
      });
      setSuccess(`Availability updated for ${date}.`);
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Could not save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 max-h-[92vh] overflow-auto">
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-xl font-bold">x</button>
        <h3 className="text-2xl font-bold text-slate-900 font-serif mb-1">Manage Availability</h3>
        <p className="text-slate-500 text-sm mb-5">Publish open slots so patients can see and book your appointments.</p>

        {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4">{success}</div>}

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Date</label>
            <input
              type="date"
              value={date}
              min={toDateValue(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Slots</label>
            <div className="flex flex-wrap gap-2">
              {slotOptions.map((time) => {
                const isSelected = selectedSet.has(time);
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleSlot(time)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Add Custom Time</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(String(e.target.value || '').slice(0, 5))}
                className="px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={addCustomSlot}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Add Time
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selected Slots</label>
            {slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((time) => (
                  <span
                    key={`selected-${time}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() => removeSelectedSlot(time)}
                      className="text-blue-700 hover:text-blue-900"
                      aria-label={`Remove ${time}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No slots selected yet.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
            {loading ? <span className="text-sm text-slate-500">Loading saved slots...</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
