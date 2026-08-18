import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { AiStatusBanner } from "./AiStatusBanner";
import {
  AI_SETTINGS_TABS,
  AI_TAB_DESCRIPTIONS,
  AI_TAB_LABELS,
  resolveAiSettingsTab,
  type AiSettingsTab,
} from "./workloadCopy";

export function AiSettingsShell({
  children,
}: {
  children: (tab: AiSettingsTab) => ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveAiSettingsTab(searchParams.get("tab"));
  const description = AI_TAB_DESCRIPTIONS[tab];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">Artificial Intelligence</h1>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setSearchParams(value === "usage" ? {} : { tab: value })
        }
      >
        <TabsList className="h-auto max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-muted p-1">
          {AI_SETTINGS_TABS.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-md px-4 py-1.5 data-[state=active]:border data-[state=active]:border-accent",
                "data-[state=active]:bg-surface data-[state=active]:text-accent data-[state=active]:shadow-sm",
              )}
            >
              {AI_TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <AiStatusBanner />
        </div>

        {AI_SETTINGS_TABS.map((value) => (
          <TabsContent key={value} value={value} className="mt-5 space-y-6">
            {children(value)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
