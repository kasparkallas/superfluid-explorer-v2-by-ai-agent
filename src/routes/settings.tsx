import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useSettings, type Theme, type DecimalPlaces } from "~/lib/hooks/use-settings";
import type { FlowRateGranularity } from "~/lib/utils/format";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, setSettings } = useSettings();

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Theme</label>
              <Select
                value={settings.theme}
                onValueChange={(value) => setSettings({ theme: value as Theme })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
            <CardDescription>Configure how data is displayed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Stream Granularity</label>
                <p className="text-xs text-muted-foreground">
                  How flow rates are displayed
                </p>
              </div>
              <Select
                value={settings.granularity}
                onValueChange={(value) =>
                  setSettings({ granularity: value as FlowRateGranularity })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/s">Per second</SelectItem>
                  <SelectItem value="/min">Per minute</SelectItem>
                  <SelectItem value="/hr">Per hour</SelectItem>
                  <SelectItem value="/day">Per day</SelectItem>
                  <SelectItem value="/wk">Per week</SelectItem>
                  <SelectItem value="/mo">Per month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Decimal Places</label>
                <p className="text-xs text-muted-foreground">
                  Precision for token amounts
                </p>
              </div>
              <Select
                value={String(settings.decimals)}
                onValueChange={(value) =>
                  setSettings({
                    decimals: value === "smart" ? "smart" : (Number(value) as DecimalPlaces),
                  })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Smart</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="18">18</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Networks</CardTitle>
            <CardDescription>Configure network visibility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Show Testnets</label>
                <p className="text-xs text-muted-foreground">
                  Display testnet networks in the selector
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showTestnets}
                onClick={() => setSettings({ showTestnets: !settings.showTestnets })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showTestnets ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    settings.showTestnets ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
