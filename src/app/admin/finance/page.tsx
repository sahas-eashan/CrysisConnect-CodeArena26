"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const data = [
  { name: "Shelter ops", amount: 650000 },
  { name: "Medical aid", amount: 420000 },
  { name: "Food & water", amount: 310000 },
  { name: "Rescue logistics", amount: 120000 }
];

export default function AdminFinancePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Financial allocation dashboard</CardTitle>
        <CardDescription className="mt-2">
          Track relief budget distribution across operational categories and partner organizations.
        </CardDescription>
        <div className="mt-6 h-[360px]">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="amount" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
