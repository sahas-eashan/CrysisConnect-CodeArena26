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
    <Card>
      <CardDescription>{label}</CardDescription>
      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
      ) : (
        <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
      )}
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </Card>
  );
}
