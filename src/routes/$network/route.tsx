import { createFileRoute, Outlet, Link, useParams, notFound } from "@tanstack/react-router";
import { getNetworkBySlug } from "~/lib/config/networks";

export const Route = createFileRoute("/$network")({
  beforeLoad: ({ params }) => {
    const network = getNetworkBySlug(params.network);
    if (!network) {
      throw notFound();
    }
  },
  component: NetworkLayout,
});

function NetworkLayout() {
  const { network } = useParams({ from: "/$network" });
  const networkConfig = getNetworkBySlug(network);

  if (!networkConfig) return null;

  const navLinks = [
    { to: "/$network/", label: "Home", params: { network } },
    { to: "/$network/supertokens", label: "Tokens", params: { network } },
    { to: "/$network/protocol", label: "Protocol", params: { network } },
    { to: "/$network/liquidations", label: "Liquidations", params: { network } },
    { to: "/$network/super-apps", label: "Super Apps", params: { network } },
  ] as const;

  return (
    <div>
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-10 items-center gap-6 px-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{networkConfig.name}</span>
            <span className="text-xs">({networkConfig.chainId})</span>
          </div>
          <div className="flex items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to as string}
                params={link.params}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground [&.active]:font-medium"
                activeOptions={{ exact: link.label === "Home" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
