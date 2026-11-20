"use client";

import { useEffect } from "react";
import { markPostViewed } from "@/app/actions";

export const READ_EVENT = "jornal:read";

export function ViewTracker({ postId }: { postId: number }) {
  useEffect(() => {
    markPostViewed(postId)
      .then(() => window.dispatchEvent(new Event(READ_EVENT)))
      .catch(() => undefined);
  }, [postId]);
  return null;
}
