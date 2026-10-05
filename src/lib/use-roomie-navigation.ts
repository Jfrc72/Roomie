"use client";
import { useRouter } from "next/navigation";
import { isInternalPath } from "./paths";

export function useRoomieNavigation() {
  const router = useRouter();
  return {
    goAfterLogin() {
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && isInternalPath(next) ? next : "/");
      router.refresh();
    },
    switchAuth(register: boolean) {
      const next = new URLSearchParams(window.location.search).get("next");
      const path = register ? "/registro" : "/login";
      router.push(
        next && isInternalPath(next)
          ? `${path}?next=${encodeURIComponent(next)}`
          : path,
      );
    },
    go: router.push,
  };
}
