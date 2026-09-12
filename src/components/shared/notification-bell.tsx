import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
      <Bell className="h-5 w-5 text-slate-200" />
      {count > 0 ? (
        <Badge className="absolute -right-2 -top-2 border-danger bg-danger text-white shadow-[0_8px_18px_rgba(239,68,68,0.35)]">
          {count}
        </Badge>
      ) : null}
    </div>
  );
}
