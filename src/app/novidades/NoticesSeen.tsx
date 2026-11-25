"use client";

import { useEffect } from "react";
import { READ_EVENT } from "@/components/ViewTracker";
import { markAllNoticesRead } from "./actions";

export function NoticesSeen({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread === 0) return;
    markAllNoticesRead()
      .then(() => window.dispatchEvent(new Event(READ_EVENT)))
      .catch(() => undefined);
  }, [unread]);
  return null;
}
