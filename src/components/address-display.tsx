import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { resolveAddress } from "~/lib/api/whois";
import { truncateAddress, checksumAddress } from "~/lib/utils/address";
import { CopyButton } from "./copy-button";
import { ExternalLink } from "./external-link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface AddressDisplayProps {
  address: string;
  network?: string;
  blockExplorerUrl?: string;
  showCopy?: boolean;
  showExternalLink?: boolean;
  showInternalLink?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  network,
  blockExplorerUrl,
  showCopy = true,
  showExternalLink = true,
  showInternalLink = true,
  className,
}: AddressDisplayProps) {
  const checksummed = checksumAddress(address);
  const truncated = truncateAddress(checksummed);

  const { data: whois } = useQuery({
    queryKey: ["whois", address.toLowerCase()],
    queryFn: () => resolveAddress({ data: address.toLowerCase() }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!address,
  });

  const displayName = whois?.name;

  const addressContent = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 font-mono text-sm", className)}>
            {displayName ? (
              <span className="flex items-center gap-1">
                <span className="font-sans font-medium">{displayName}</span>
                <span className="text-muted-foreground text-xs">{truncated}</span>
              </span>
            ) : (
              <span>{truncated}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{checksummed}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {showInternalLink && network ? (
        <Link
          to="/$network/accounts/$address"
          params={{ network, address: address.toLowerCase() }}
          search={{}}
          className="hover:underline"
        >
          {addressContent}
        </Link>
      ) : (
        addressContent
      )}
      {showCopy && <CopyButton value={checksummed} />}
      {showExternalLink && blockExplorerUrl && (
        <ExternalLink href={`${blockExplorerUrl}/address/${address}`} />
      )}
    </span>
  );
}
