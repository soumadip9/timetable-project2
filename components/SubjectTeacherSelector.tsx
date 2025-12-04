"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Teacher = { _id: string; name: string; subject: string; email?: string; room?: string };

export default function SubjectTeacherSelector({
  classId,
  initialSubjects,
  onTimetableGenerated,
}: {
  classId: string;
  initialSubjects: string[];
  onTimetableGenerated?: () => void;
}) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects || []);
  const [map, setMap] = useState<Record<string, string | null>>({});
  
  // Update subjects when initialSubjects prop changes (e.g., after generation saves subjects)
  useEffect(() => {
    if (initialSubjects && initialSubjects.length > 0) {
      setSubjects(initialSubjects);
    }
  }, [initialSubjects]);
  const [loading, setLoading] = useState(false);
  const [selectedSubjectToAdd, setSelectedSubjectToAdd] = useState<string>("");
  
  // localStorage key for this class's settings
  const settingsKey = `timetable-settings-${classId}`;
  
  // Helper functions to load/save settings
  const loadSettings = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(settingsKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return null;
  };

  const saveSettings = (settings: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Default settings
  const defaultEnabledDays: Record<number, boolean> = {
    1: true, // Monday
    2: true, // Tuesday
    3: true, // Wednesday
    4: true, // Thursday
    5: true, // Friday
    6: true, // Saturday
  };
  
  const defaultMaxPeriodsPerDayConfig: Record<number, number> = {
    1: 7, // Monday
    2: 7, // Tuesday
    3: 7, // Wednesday
    4: 7, // Thursday
    5: 7, // Friday
    6: 7, // Saturday
  };

  // Load saved settings on mount
  const savedSettings = loadSettings();
  
  // Day and period configuration
  const [enabledDays, setEnabledDays] = useState<Record<number, boolean>>(
    savedSettings?.enabledDays || defaultEnabledDays
  );
  const [maxPeriodsPerDayConfig, setMaxPeriodsPerDayConfig] = useState<Record<number, number>>(
    savedSettings?.maxPeriodsPerDayConfig || defaultMaxPeriodsPerDayConfig
  );
  
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(
    savedSettings?.showAdvancedFilters || false
  );
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState<string>(
    savedSettings?.maxPeriodsPerDay || ""
  );
  const [maxPeriodsPerWeek, setMaxPeriodsPerWeek] = useState<string>(
    savedSettings?.maxPeriodsPerWeek || ""
  );
  const [subjectFrequency, setSubjectFrequency] = useState<Array<{ subject: string; maxPerWeek: string }>>(
    savedSettings?.subjectFrequency || []
  );
  
  const router = useRouter();
  
  // Save settings whenever they change
  useEffect(() => {
    saveSettings({
      enabledDays,
      maxPeriodsPerDayConfig,
      showAdvancedFilters,
      maxPeriodsPerDay,
      maxPeriodsPerWeek,
      subjectFrequency,
    });
  }, [enabledDays, maxPeriodsPerDayConfig, showAdvancedFilters, maxPeriodsPerDay, maxPeriodsPerWeek, subjectFrequency, settingsKey]);
  
  const dayNames = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  useEffect(() => {
    fetch("/api/teachers?simple=true")
      .then((r) => r.json())
      .then((d) => setTeachers(d.teachers || []))
      .catch(() => setTeachers([]));
  }, []);

  // Get unique subjects from teachers, plus lab subjects
  const availableSubjects = React.useMemo(() => {
    const uniqueSubjects = new Set<string>();
    teachers.forEach((t) => {
      if (t.subject) {
        uniqueSubjects.add(t.subject);
      }
    });
    // Add lab subjects as separate subjects
    uniqueSubjects.add('Physics Lab');
    uniqueSubjects.add('Chemistry Lab');
    uniqueSubjects.add('Computer Science Lab');
    return Array.from(uniqueSubjects).sort();
  }, [teachers]);

  // Get subjects that are not already added
  const availableSubjectsToAdd = availableSubjects.filter((s) => !subjects.includes(s));

  useEffect(() => {
    const m: Record<string, string | null> = {};
    (subjects || []).forEach((s) => (m[s] = null));
    setMap(m);
  }, [subjects]);

  function handleSubjectChange(idx: number, value: string) {
    const copy = [...subjects];
    copy[idx] = value;
    setSubjects(copy);
    // reinit map for new subject keys
    const m: Record<string, string | null> = {};
    copy.forEach((s) => (m[s] = map[s] ?? null));
    setMap(m);
  }

  function handleSelect(subj: string, teacherId: string | "none") {
    setMap((prev) => ({ ...prev, [subj]: teacherId === "none" ? null : teacherId }));
  }

  async function saveSubjectsToClass() {
    // If you'd like to persist subjects on Class model, call an API route to save them.
    // For now we just keep them locally; admin can regenerate after editing.
    alert("Subjects updated locally. Click Generate to create timetable.");
  }

  async function generate(assignmentStrategy: "roundrobin" | "random" = "roundrobin") {
    setLoading(true);
    try {
      // Build enabled days array and get max periods per day
      const activeDays = dayNames
        .filter((day) => enabledDays[day.value])
        .map((day) => day.value);
      
      // Build request body with filters
      const body: any = {
        subjects,
        subjectTeacherMap: map,
        assignmentStrategy,
        days: activeDays,
        // Use day-specific period limits
        dayPeriodLimits: activeDays.reduce((acc, day) => {
          acc[day] = maxPeriodsPerDayConfig[day] || 7;
          return acc;
        }, {} as Record<number, number>),
      };

      // Add advanced filters if provided
      if (maxPeriodsPerDay && maxPeriodsPerDay.trim() !== "") {
        body.maxPeriodsPerDay = parseInt(maxPeriodsPerDay, 10);
      }

      if (maxPeriodsPerWeek && maxPeriodsPerWeek.trim() !== "") {
        body.maxPeriodsPerWeek = parseInt(maxPeriodsPerWeek, 10);
      }

      if (subjectFrequency.length > 0) {
        body.subjectFrequency = subjectFrequency
          .filter((item) => item.subject.trim() !== "" && item.maxPerWeek.trim() !== "")
          .map((item) => ({
            subject: item.subject.trim(),
            maxPerWeek: parseInt(item.maxPerWeek, 10),
          }));
      }

      const res = await fetch(`/api/classes/${classId}/generate-timetable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate timetable");
      } else {
        // Small delay to ensure database is updated
        setTimeout(() => {
          // Call the callback to reload timetable data
          if (onTimetableGenerated) {
            onTimetableGenerated();
          }
          router.refresh();
        }, 500);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate timetable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 border rounded-2xl bg-gradient-to-br from-white via-gray-50 to-white shadow-2xl border-gray-200">
      <h3 className="text-3xl font-extrabold text-gray-900 mb-7 flex items-center gap-3 tracking-tight">
        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Subjects for this class
      </h3>

      <div className="space-y-3 mb-6">
        {subjects.map((s, i) => (
          <div key={i} className="flex gap-3 items-center p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 hover:border-indigo-300">
            <input
              value={s}
              onChange={(e) => handleSubjectChange(i, e.target.value)}
              className="flex-1 border-2 border-gray-300 rounded-xl px-5 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-gray-50 hover:bg-white placeholder:text-gray-400"
            />
            <button
              onClick={() => {
                const copy = [...subjects];
                copy.splice(i, 1);
                setSubjects(copy);
                const newMap: Record<string, string | null> = {};
                copy.forEach((subj) => (newMap[subj] = map[subj] ?? null));
                setMap(newMap);
              }}
              className="px-5 py-3 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl text-red-700 font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-md border border-red-200"
            >
              Remove
            </button>
          </div>
        ))}

        <div className="flex gap-3 mt-4 p-5 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border-2 border-indigo-200 shadow-md">
          {availableSubjectsToAdd.length > 0 ? (
            <select
              value={selectedSubjectToAdd}
              onChange={(e) => {
                const val = e.target.value;
                if (val && !subjects.includes(val)) {
                  setSubjects((prev) => [...prev, val]);
                  setSelectedSubjectToAdd("");
                }
              }}
              className="flex-1 border-2 border-indigo-300 rounded-xl px-5 py-3.5 text-lg font-bold text-gray-900 bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <option value="" className="text-gray-500 font-normal">
                Select a subject to add
              </option>
              {availableSubjectsToAdd.map((subject) => (
                <option key={subject} value={subject} className="text-gray-900 font-semibold">
                  {subject}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder="Add custom subject (type and press Enter)"
              className="flex-1 border-2 border-indigo-300 rounded-xl px-5 py-3.5 text-lg font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white shadow-md hover:shadow-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val && !subjects.includes(val)) {
                    setSubjects((prev) => [...prev, val]);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          )}
          <button
            onClick={saveSubjectsToClass}
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl text-white font-bold text-base transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95 shadow-lg"
            type="button"
          >
            Save subjects
          </button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t-2 border-gray-300">
        <h4 className="text-2xl font-extrabold text-gray-900 mb-3 flex items-center gap-3 tracking-tight">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Assign teacher per subject
        </h4>
        <p className="text-base text-gray-700 mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border-2 border-blue-200 shadow-sm">
          <span className="font-bold text-blue-900">Note:</span> Teacher availability will be checked during generation. Teachers with schedule conflicts will be automatically replaced.
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {subjects.map((subj) => (
            <div key={subj} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 hover:border-indigo-300">
              <div className="w-48 text-lg font-bold text-gray-900">{subj}</div>
              <select
                className="flex-1 border-2 border-gray-300 rounded-xl px-5 py-3 text-lg font-bold text-gray-900 bg-gray-50 hover:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer shadow-md hover:shadow-lg"
                value={map[subj] ?? "none"}
                onChange={(e) => handleSelect(subj, e.target.value as string)}
              >
                <option value="none" className="text-gray-500 font-medium">— Auto assign (pick subject-specialist)</option>
                {teachers
                  .filter((t) => t.subject === subj)
                  .map((t) => (
                    <option key={t._id} value={t._id} className="text-gray-900 font-bold">
                      {t.name} — {t.subject}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Day and Period Configuration */}
      <div className="mt-8 pt-6 border-t-2 border-gray-300">
        <h4 className="text-2xl font-extrabold text-gray-900 mb-5 flex items-center gap-3 tracking-tight">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Day and Period Configuration
        </h4>
        <div className="space-y-3">
          {dayNames.map((day) => (
            <div key={day.value} className="flex items-center gap-4 p-5 bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 hover:border-indigo-300">
              <label className="inline-flex items-center gap-3 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={enabledDays[day.value] || false}
                  onChange={(e) => {
                    setEnabledDays((prev) => ({
                      ...prev,
                      [day.value]: e.target.checked,
                    }));
                  }}
                  className="w-6 h-6 text-indigo-600 border-2 border-gray-400 rounded-md focus:ring-indigo-500 cursor-pointer shadow-sm"
                />
                <span className="text-lg font-extrabold text-gray-900 w-32 tracking-wide">{day.label}</span>
              </label>
              {enabledDays[day.value] && (
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-base font-bold text-gray-800">Max periods:</span>
                  <input
                    type="number"
                    min="0"
                    max="8"
                    value={maxPeriodsPerDayConfig[day.value] || 7}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      const clampedVal = Math.max(0, Math.min(7, val));
                      setMaxPeriodsPerDayConfig((prev) => ({
                        ...prev,
                        [day.value]: clampedVal,
                      }));
                      // If set to 0, automatically disable the day
                      if (clampedVal === 0) {
                        setEnabledDays((prev) => ({
                          ...prev,
                          [day.value]: false,
                        }));
                      }
                    }}
                    className="w-28 px-5 py-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-xl font-extrabold text-indigo-700 bg-white shadow-lg hover:shadow-xl transition-all"
                  />
                  <span className="text-sm text-gray-600 font-semibold">(0-8, 0 = day off)</span>
                </div>
              )}
              {!enabledDays[day.value] && (
                <span className="text-base text-red-600 italic font-bold bg-gradient-to-r from-red-50 to-pink-50 px-4 py-2 rounded-xl border-2 border-red-200 shadow-md">Day off</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Filters Section */}
      <div className="mt-8 pt-6 border-t-2 border-gray-300">
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-3 text-xl font-extrabold text-gray-900 hover:text-indigo-600 transition-all p-4 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 w-full border-2 border-transparent hover:border-indigo-200 shadow-md hover:shadow-lg"
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${showAdvancedFilters ? "rotate-90" : ""} text-indigo-600`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Advanced Filters
        </button>

        {showAdvancedFilters && (
          <div className="mt-5 space-y-5 pl-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 p-7 rounded-2xl border-2 border-indigo-200 shadow-lg">
            {/* Max Periods Per Day */}
            <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all">
              <label className="block text-base font-extrabold text-gray-900 mb-3 tracking-tight">
                Max Periods Per Day (per teacher)
              </label>
              <input
                type="number"
                min="1"
                value={maxPeriodsPerDay}
                onChange={(e) => setMaxPeriodsPerDay(e.target.value)}
                placeholder="e.g., 4 (optional)"
                className="w-full px-5 py-4 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-extrabold text-gray-900 bg-gray-50 hover:bg-white transition-all shadow-md hover:shadow-lg"
              />
              <p className="text-sm text-gray-700 mt-3 font-semibold">Limit how many periods a teacher can teach per day</p>
            </div>

            {/* Max Periods Per Week */}
            <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all">
              <label className="block text-base font-extrabold text-gray-900 mb-3 tracking-tight">
                Max Periods Per Week (per teacher)
              </label>
              <input
                type="number"
                min="1"
                value={maxPeriodsPerWeek}
                onChange={(e) => setMaxPeriodsPerWeek(e.target.value)}
                placeholder="e.g., 20 (optional)"
                className="w-full px-5 py-4 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-extrabold text-gray-900 bg-gray-50 hover:bg-white transition-all shadow-md hover:shadow-lg"
              />
              <p className="text-sm text-gray-700 mt-3 font-semibold">Limit total periods a teacher can teach per week</p>
            </div>

            {/* Subject Frequency */}
            <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all">
              <label className="block text-base font-extrabold text-gray-900 mb-4 flex items-center gap-3 tracking-tight">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Subject Frequency Limits (per week)
              </label>
              <div className="space-y-3">
                {subjectFrequency.map((item, index) => {
                  // Get subjects that haven't been selected in other frequency entries
                  const usedSubjects = subjectFrequency
                    .filter((_, i) => i !== index && _.subject)
                    .map((f) => f.subject);
                  const availableSubjectsForDropdown = subjects.filter((s) => 
                    !usedSubjects.includes(s) || s === item.subject
                  );

                  return (
                    <div key={index} className="flex gap-3 items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all">
                      <select
                        value={item.subject}
                        onChange={(e) => {
                          const updated = [...subjectFrequency];
                          updated[index].subject = e.target.value;
                          setSubjectFrequency(updated);
                        }}
                        className="flex-1 px-5 py-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-bold text-gray-900 bg-white shadow-md hover:shadow-lg transition-all"
                      >
                        <option value="" className="text-gray-500 font-medium">Select subject</option>
                        {availableSubjectsForDropdown.map((subject) => (
                          <option key={subject} value={subject} className="text-gray-900 font-bold">
                            {subject}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.maxPerWeek}
                        onChange={(e) => {
                          const updated = [...subjectFrequency];
                          updated[index].maxPerWeek = e.target.value;
                          setSubjectFrequency(updated);
                        }}
                        placeholder="Max"
                        className="w-28 px-5 py-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-xl font-extrabold text-indigo-700 bg-white shadow-md hover:shadow-lg transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectFrequency(subjectFrequency.filter((_, i) => i !== index));
                        }}
                        className="px-4 py-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-red-200 shadow-md"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
                {subjects.length === 0 ? (
                  <p className="text-base text-gray-700 italic font-bold bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-xl border-2 border-yellow-300 shadow-md">Add subjects to this class first to set frequency limits</p>
                ) : subjectFrequency.length < subjects.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectFrequency([...subjectFrequency, { subject: "", maxPerWeek: "" }]);
                    }}
                    className="text-base text-indigo-600 hover:text-indigo-800 font-extrabold bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 px-5 py-3 rounded-xl border-2 border-indigo-300 transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                  >
                    + Add Subject Limit
                  </button>
                ) : (
                  <p className="text-base text-green-700 italic font-bold bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-300 shadow-md">✓ All subjects have frequency limits set</p>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-4 font-bold">Limit how many times each subject appears per week</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t-2 border-gray-300">
        <div className="flex gap-5">
          <button
            className="flex-1 px-8 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-2xl font-extrabold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 tracking-wide"
            onClick={() => generate("roundrobin")}
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Generating..." : "Generate (Round Robin)"}
          </button>
          <button
            className="flex-1 px-8 py-5 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white rounded-2xl font-extrabold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 tracking-wide"
            onClick={() => generate("random")}
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {loading ? "Generating..." : "Generate (Random)"}
          </button>
        </div>
      </div>
    </div>
  );
}

