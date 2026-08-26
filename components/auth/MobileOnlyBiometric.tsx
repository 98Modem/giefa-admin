"use client";

import { useEffect, useState, type ReactNode } from "react";

const MOBILE_BIOMETRIC_QUERY =
  "(max-width: 1023px) and (hover: none) and (pointer: coarse)";

export default function MobileOnlyBiometric({
  children,
}: {
  children: ReactNode;
}) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_BIOMETRIC_QUERY);
    const updateVisibility = () => setIsMobileDevice(media.matches);

    updateVisibility();
    media.addEventListener("change", updateVisibility);

    return () => media.removeEventListener("change", updateVisibility);
  }, []);

  return isMobileDevice ? children : null;
}
