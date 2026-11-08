"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/lexical/ui";

/** Shows the Print Agent key once, with a copy button. (The agent already knows the server address - only the key is needed.) */
export default function AgentKeyBox({ agentKey }: { agentKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(agentKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the user can still select the text */
    }
  }

  return (
    <div className="space-y-3">
      <Alert tone="warning" icon="🔑">
        Copy this key now — it is shown <b>only once</b>. Paste it into the desktop Print Agent on your shop PC. Printers that
        agent finds will appear only in <b>your</b> dashboard.
      </Alert>
      <div>
        <div className="mb-1 text-xs text-slate-900/60">Agent API key</div>
        <div className="flex gap-2">
          <code className="min-w-0 grow break-all rounded-lg bg-slate-900/[0.05] px-3 py-2 text-[13px]">{agentKey}</code>
          <Button variant="light" size="sm" type="button" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
