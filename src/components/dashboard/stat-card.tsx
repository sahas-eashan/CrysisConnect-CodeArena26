import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  loading = false
}: {
  label: string;
  value: string | number;
  helper?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-sky-950/60">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="mt-2 text-3xl text-white">{value}</CardTitle>
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </Card>
  );
}
