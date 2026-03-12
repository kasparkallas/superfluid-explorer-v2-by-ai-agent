import { useNavigate, useSearch } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface TabsWithUrlProps {
  tabs: Tab[];
  defaultTab: string;
  paramName?: string;
}

export function TabsWithUrl({ tabs, defaultTab, paramName = "tab" }: TabsWithUrlProps) {
  const navigate = useNavigate();
  // Read from current URL search params
  const search = useSearch({ strict: false }) as Record<string, string>;
  const currentTab = (search[paramName] as string) || defaultTab;

  const onValueChange = (value: string) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        [paramName]: value === defaultTab ? undefined : value,
      }),
      replace: true,
    } as any);
  };

  return (
    <Tabs value={currentTab} onValueChange={onValueChange}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
