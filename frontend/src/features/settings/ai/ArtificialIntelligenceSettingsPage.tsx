import { AiSettingsShell } from "./AiSettingsShell";
import { ControlsPanel } from "./ControlsPanel";
import { ModelsPanel } from "./ModelsPanel";
import { UsagePanel } from "./UsagePanel";
import { AIProvidersSettings } from "@/components/settings/AIProvidersSettings";

export function ArtificialIntelligenceSettingsPage() {
  return (
    <AiSettingsShell>
      {(tab) => {
        if (tab === "usage") return <UsagePanel />;
        if (tab === "models") {
          return (
            <div className="space-y-8">
              <ModelsPanel />
              <section id="providers" className="scroll-mt-4" aria-label="Providers">
                <AIProvidersSettings />
              </section>
            </div>
          );
        }
        return <ControlsPanel />;
      }}
    </AiSettingsShell>
  );
}
