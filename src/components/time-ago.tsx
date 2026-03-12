import { useState, useEffect } from "react";
import { formatRelativeTime, formatTimestamp } from "~/lib/utils/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

interface TimeAgoProps {
  timestamp: string | number;
  className?: string;
}

export function TimeAgo({ timestamp, className }: TimeAgoProps) {
  const [relative, setRelative] = useState(() => formatRelativeTime(timestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      setRelative(formatRelativeTime(timestamp));
    }, 10000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>{relative}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{formatTimestamp(timestamp)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
