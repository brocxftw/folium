import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

interface AskFoliumFabProps {
  onClick: () => void;
  className?: string;
}

/** Round Ask Folium control used in document preview and the global dock. */
export function AskFoliumFab({ onClick, className }: AskFoliumFabProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ask Folium AI"
          onClick={onClick}
          className={cn(
            "flex h-12 w-12 items-center justify-center",
            "rounded-full bg-accent text-white shadow-md",
            "transition hover:bg-accent-hover hover:shadow-lg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
            className,
          )}
        >
          <Leaf className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Ask Folium AI</TooltipContent>
    </Tooltip>
  );
}
