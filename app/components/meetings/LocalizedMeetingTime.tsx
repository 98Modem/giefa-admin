"use client";

import { useMemo } from "react";
import { useBrowserTimeZone } from "./useBrowserTimeZone";

type LocalizedMeetingTimeProps = {
  startsAt: string;
  endsAt: string;
  className?: string;
};

function localTimeLabel(startsAt: string, endsAt: string, timeZone: string) {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });
  const endFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });

  return `${dateFormatter.format(new Date(startsAt))} – ${endFormatter.format(
    new Date(endsAt)
  )}`;
}

export function LocalizedMeetingTime({
  startsAt,
  endsAt,
  className,
}: LocalizedMeetingTimeProps) {
  const timeZone = useBrowserTimeZone();
  const label = useMemo(
    () => localTimeLabel(startsAt, endsAt, timeZone),
    [startsAt, endsAt, timeZone]
  );

  return (
    <time dateTime={startsAt} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
