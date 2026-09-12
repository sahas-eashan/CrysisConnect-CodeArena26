import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <Card>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </Card>
  );
}
