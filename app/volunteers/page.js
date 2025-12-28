'use client';

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Sample hierarchical volunteer data (level tagged)
const rawData = [
  { level: 'All', name: 'Active', value: 420 },
  { level: 'All', name: 'Pending', value: 90 },
  { level: 'All', name: 'Inactive', value: 60 },
  { level: 'All', name: 'On Leave', value: 30 },

  // Constituency-level breakdown (example)
  { level: 'Constituency', name: 'Active', value: 220 },
  { level: 'Constituency', name: 'Pending', value: 50 },
  { level: 'Constituency', name: 'Inactive', value: 30 },
  { level: 'Constituency', name: 'On Leave', value: 10 },

  // Ward-level breakdown (example)
  { level: 'Ward', name: 'Active', value: 120 },
  { level: 'Ward', name: 'Pending', value: 25 },
  { level: 'Ward', name: 'Inactive', value: 20 },
  { level: 'Ward', name: 'On Leave', value: 5 },

  // Booth-level breakdown (example)
  { level: 'Booth', name: 'Active', value: 80 },
  { level: 'Booth', name: 'Pending', value: 15 },
  { level: 'Booth', name: 'Inactive', value: 10 },
  { level: 'Booth', name: 'On Leave', value: 15 },
];

const LEVEL_OPTIONS = ['All', 'Constituency', 'Ward', 'Booth'];
const COLORS = ['#10B981', '#F59E0B', '#6B7280', '#EF4444'];

export default function VolunteerCountCard() {
  const [level, setLevel] = useState('All');
  const [selectedUnit, setSelectedUnit] = useState('All'); // placeholder for further unit-level filtering (e.g., choose specific booth)

  // Aggregate data for the chosen level
  const data = useMemo(() => {
    // Filter rawData by the selected level
    const filtered = rawData.filter((d) => d.level === level);
    // If there is no specific data for a chosen level, fallback to the 'All' level
    const used = filtered.length ? filtered : rawData.filter((d) => d.level === 'All');

    // Map to chart-friendly structure (merge by name just in case)
    const map = {};
    used.forEach((d) => {
      if (!map[d.name]) map[d.name] = 0;
      map[d.name] += d.value;
    });

    return Object.keys(map).map((k) => ({ name: k, value: map[k] }));
  }, [level]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Example unit list for the selected level (in real app this would come from API)
  const unitOptions = useMemo(() => {
    if (level === 'Booth') return ['All Booths', 'Booth 037', 'Booth 102', 'Booth 215'];
    if (level === 'Ward') return ['All Wards', 'Ward A', 'Ward B', 'Ward C'];
    if (level === 'Constituency') return ['Entire Constituency'];
    return ['All'];
  }, [level]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Volunteer Count</h2>
            <p className="text-sm text-gray-500">Overview of volunteer status across the constituency (filter level-wise)</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Level filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Level</label>
              <select
                value={level}
                onChange={(e) => { setLevel(e.target.value); setSelectedUnit('All'); }}
                className="ml-2 h-9 rounded-md border px-3 text-sm"
              >
                {LEVEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Unit filter (dependent on level) */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Unit</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="ml-2 h-9 rounded-md border px-3 text-sm"
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Simple export button placeholder */}
            <button className="ml-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 items-center">
          {/* Left: Stats list */}
          <div className="col-span-5">
            <div className="space-y-4">
              {data.map((d, idx) => (
                <div key={d.name} className="flex items-center justify-between p-4 rounded-xl border">
                  <div className="flex items-center gap-4">
                    <span className={`w-3 h-3 rounded-full`} style={{ background: COLORS[idx] }} />
                    <div>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-gray-500">{total ? Math.round((d.value / total) * 100) : 0}% of total</div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold">{d.value}</div>
                </div>
              ))}

              <div className="p-4 rounded-xl border">
                <div className="text-sm text-gray-500">Last updated</div>
                <div className="text-sm">Dec 4, 2025 • 23:00 IST</div>
              </div>

              <div className="p-4 rounded-xl border">
                <div className="text-sm font-medium mb-2">Top Units by Volunteer Count</div>
                <ol className="list-decimal pl-5 text-sm space-y-1">
                  <li>Booth 102 — 48</li>
                  <li>Booth 215 — 41</li>
                  <li>Booth 037 — 39</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Right: Pie chart */}
          <div className="col-span-7 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={38}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
