import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Independently collapsible so the stat block can stay compact during play.
// Text is only written when the DM edits it — opening or closing changes nothing.
export function DescriptionSection({ description, onChange }: { description: string; onChange?: (description: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="border-t border-border pt-2">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-0 font-semibold" aria-label={expanded ? "Collapse description" : "Expand description"}>
            <ChevronDown className={cn("h-4 w-4", !expanded && "-rotate-90")} /> Description &amp; lore
          </Button>
        </CollapsibleTrigger>
        {expanded && onChange && <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit"}</Button>}
      </div>
      <CollapsibleContent className="pt-2">
        {editing && onChange
          ? <Textarea aria-label="Monster description" value={description} onChange={(e) => onChange(e.target.value)} placeholder="Appearance, lore, and story…" className="min-h-48 text-sm" />
          : description
            ? <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{description}</div>
            : <p className="text-sm text-muted-foreground">No description provided by this source.</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}
