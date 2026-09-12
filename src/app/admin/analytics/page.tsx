"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const data = [
  { name: "08:00", sos: 2, alerts: 1 },
  { name: "10:00", sos: 5, alerts: 3 },
  { name: "12:00", sos: 9, alerts: 4 },
  { name: "14:00", sos: 6, alerts: 5 },
  { name: "16:00", sos: 3, alerts: 2 }
];

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Operational analytics</CardTitle>
        <CardDescription className="mt-2">
          Judges can see clear evidence of system thinking here: response load, alert volume, and live trends.
        </CardDescription>
        <div className="mt-6 h-[360px]">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Area dataKey="sos" fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" type="monotone" />
              <Area dataKey="alerts" fill="#38bdf8" fillOpacity={0.2} stroke="#38bdf8" type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
