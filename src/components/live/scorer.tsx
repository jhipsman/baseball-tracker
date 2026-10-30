"use client";
import { useRouter } from "next/navigation";
import {
  finishLiveGame,
  recordPitch,
  recordPlay,
  undoLastPlay,
  updateGameSetup,
} from "@/lib/live-actions";
import { ScoringWorkspace } from "./scoring-workspace";
import type { ScorerProps } from "./scoring-types";
export type { ScorerProps, SmartStatus } from "./scoring-types";
export function Scorer(props: ScorerProps) {
  const router = useRouter();
  async function refresh(action: Promise<{ error?: string }>) {
    const result = await action;
    if (!result.error) router.refresh();
    return result;
  }
  return (
    <ScoringWorkspace
      {...props}
      actions={{
        record: (input) => refresh(recordPlay(props.gameId, input)),
        pitch: (kind) => refresh(recordPitch(props.gameId, kind)),
        undo: () => refresh(undoLastPlay(props.gameId)),
        finish: () => refresh(finishLiveGame(props.gameId)),
        setup: (input) => refresh(updateGameSetup(props.gameId, input)),
      }}
    />
  );
}
