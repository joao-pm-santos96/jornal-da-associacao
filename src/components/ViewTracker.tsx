"use client";

import { useEffect } from "react";
import { markPostViewed } from "@/app/actions";

export function ViewTracker({ postId }: { postId: number }) {
  useEffect(() => {
    markPostViewed(postId).catch(() => undefined);
  }, [postId]);
  return null;
}
