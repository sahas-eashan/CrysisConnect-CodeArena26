import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <div className="relative rounded-full border border-slate-800 bg-slate-950/60 p-2">
      <Bell className="h-5 w-5 text-slate-200" />
      {count > 0 ? (
        <Badge className="absolute -right-2 -top-2 border-primary bg-primary text-slate-950">
          {count}
        </Badge>
      ) : null}
    </div>
  );
}
