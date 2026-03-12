import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { allNetworks, type Network } from "~/lib/config/networks";
import { useSettings } from "~/lib/hooks/use-settings";

export function NetworkSelector() {
  const navigate = useNavigate();
  const { network } = useParams({ strict: false }) as { network?: string };
  const { settings } = useSettings();

  const visibleNetworks = allNetworks.filter(
    (n) => !n.isTestnet || settings.showTestnets
  );

  const handleChange = (slug: string) => {
    // Navigate to the same page on the new network
    navigate({
      to: "/$network",
      params: { network: slug },
      search: {},
    });
  };

  return (
    <Select value={network || "base-mainnet"} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px] h-8">
        <SelectValue placeholder="Select network" />
      </SelectTrigger>
      <SelectContent>
        {visibleNetworks.map((n) => (
          <SelectItem key={n.slug} value={n.slug}>
            <span className="flex items-center gap-2">
              <span>{n.name}</span>
              {n.isTestnet && (
                <span className="text-xs text-muted-foreground">(testnet)</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
