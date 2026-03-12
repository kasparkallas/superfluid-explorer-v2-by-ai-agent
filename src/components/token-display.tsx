import { Link } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface TokenDisplayProps {
  address: string;
  symbol: string;
  name?: string;
  logoUrl?: string;
  network?: string;
  className?: string;
}

export function TokenDisplay({
  address,
  symbol,
  name,
  logoUrl,
  network,
  className,
}: TokenDisplayProps) {
  const content = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={symbol}
                className="h-4 w-4 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="font-medium">{symbol}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {name && <span className="block">{name}</span>}
            <span className="font-mono text-muted-foreground">{address}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (network) {
    return (
      <Link
        to="/$network/supertokens/$address"
        params={{ network, address: address.toLowerCase() }}
        search={{}}
        className="hover:underline"
      >
        {content}
      </Link>
    );
  }

  return content;
}
