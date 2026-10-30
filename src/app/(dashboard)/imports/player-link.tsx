"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { linkImportedPlayer } from "./actions";
export function ImportedPlayerLink({
  rowId,
  linked,
  players,
}: {
  rowId: string;
  linked: string | null;
  players: { id: string; name: string }[];
}) {
  const [player, setPlayer] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (linked)
    return (
      <span className="text-brand-700">
        Linked to {players.find((p) => p.id === linked)?.name ?? "roster player"}
      </span>
    );
  return (
    <div className="space-y-2">
      <label>
        <span className="sr-only">Link imported player to roster</span>
        <select
          className="h-11 max-w-48 rounded-lg bg-surface px-2 ring-1 ring-zinc-300"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
        >
          <option value="">Choose roster player</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        disabled={!player || pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await linkImportedPlayer({ rowId, playerId: player });
              setError(r.error ?? "");
            } catch {
              setError("The player could not be linked. Check your connection and try again.");
            }
          })
        }
      >
        {pending ? "Linking…" : "Link player"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
