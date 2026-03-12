import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "~/lib/config/wagmi";
import {
  SettingsContext,
  useSettingsState,
} from "~/lib/hooks/use-settings";
import { NetworkSelector } from "~/components/network-selector";
import { SearchCommand } from "~/components/search-command";
import { NavigationProgress } from "~/components/navigation-progress";
import appCss from "~/global.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Superfluid Explorer" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const { settings, setSettings } = useSettingsState();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SettingsContext.Provider value={{ settings, setSettings }}>
          {children}
        </SettingsContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="text-sf-green">SF</span>
            <span>Explorer</span>
          </Link>
          <NetworkSelector />
        </div>
        <div className="flex items-center gap-4">
          <SearchCommand />
          <Link
            to="/settings"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <NavigationProgress />
            <Header />
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
