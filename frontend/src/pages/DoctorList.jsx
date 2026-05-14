import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { doctorsAPI } from '../utils/api';

export default function DoctorList() {
  const location = useLocation();
  const [filter, setFilter] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);

  const recommendedSpecialty = location.state?.specialty;
  const recommendationReason = location.state?.reason;

  useEffect(() => {
    if (recommendedSpecialty) {
      setFilter(recommendedSpecialty);
    }
  }, [recommendedSpecialty]);

  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const { data } = await doctorsAPI.specialties();
        const specialtyList = Array.isArray(data?.specialties) ? data.specialties : [];
        setCategories(['All', ...specialtyList]);
      } catch (apiError) {
        setCategories(['All', 'Panchakarma', 'Kayachikitsa', 'Diet & Nutrition', 'Nadi Pariksha']);
      }
    };

    fetchSpecialties();
  }, []);

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      setError('');

      try {
        const params = {};
        if (filter !== 'All') params.specialty = filter;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const { data } = await doctorsAPI.list(params);
        setDoctors(data?.doctors || []);
      } catch (apiError) {
        setDoctors([]);
        setError(apiError?.response?.data?.message || 'Could not load doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [filter, searchQuery]);

  const filteredDoctors = useMemo(() => doctors, [doctors]);
  const availableCategories = useMemo(() => {
    const set = new Set(categories);
    if (filter && !set.has(filter)) {
      set.add(filter);
    }
    return [...set];
  }, [categories, filter]);

  return (
    <div className="min-h-screen pt-28 pb-20 px-6 bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {recommendedSpecialty && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-8 flex items-start gap-4 shadow-sm animate-fade-in-down">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">✨</div>
            <div>
              <h3 className="text-lg font-bold text-emerald-800 mb-1">We analyzed your symptoms.</h3>
              <p className="text-emerald-700 text-sm mb-2">{recommendationReason}</p>
              <div className="inline-block px-3 py-1 bg-white border border-emerald-200 rounded-full text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Recommended: {recommendedSpecialty}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">Find Your Specialist</h1>

          <div className="max-w-xl mx-auto relative group z-20">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search doctor by name, city, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                filter === cat
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading doctors...</div>
        ) : error ? (
          <div className="text-center py-20 text-rose-600 font-semibold">{error}</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredDoctors.length > 0 ? (
              filteredDoctors.map((doc) => {
                const specialty = doc?.doctorProfile?.specialty || 'Specialist';
                const experience = Number(doc?.doctorProfile?.experienceYears || 0);
                const rating = Number(doc?.doctorProfile?.rating || 0).toFixed(1);
                const fee = Number(doc?.doctorProfile?.consultationFee || 0);

                return (
                  <div key={doc._id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-105 transition-transform">
                        👨‍⚕️
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        <span className="text-amber-500 text-xs">★</span>
                        <span className="text-amber-900 text-xs font-bold">{rating}</span>
                      </div>
                    </div>

                    <div className="mb-6 flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{doc.fullName}</h3>
                      <p className="text-blue-600 text-xs font-bold uppercase tracking-wide mb-2">{specialty}</p>
                      <p className="text-slate-500 text-sm mb-2">{experience} years experience</p>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {doc?.doctorProfile?.location || 'Online'}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div>
                        <span className="block text-xs text-slate-400 font-medium">Consultation</span>
                        <span className="block text-slate-900 font-bold">₹{fee || 0}</span>
                      </div>
                      <Link
                        to={`/doctors/${doc._id}`}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-20 text-slate-500">
                <p className="text-xl font-serif mb-2">No doctors found matching your filters</p>
                <button onClick={() => { setSearchQuery(''); setFilter('All'); }} className="text-blue-600 font-bold hover:underline">Clear all filters</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
