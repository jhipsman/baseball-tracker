"use client";

import { useState, useTransition } from "react";
import { askTraining } from "./actions";
import { TRAINING_SOURCES, type TrainingAnswer } from "@/lib/ask-9d";

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState<TrainingAnswer>();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      <form
        className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          startTransition(async () => {
            try {
              const response = await askTraining(question, context);
              if (response.error) setError(response.error);
              else setAnswer(response.result);
            } catch {
              setError("Couldn't send your question. Please try again.");
            }
          });
        }}
      >
        <label className="block space-y-2 text-sm font-medium">
          Your question
          <textarea
            required
            maxLength={1500}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="block w-full rounded-xl border border-zinc-300 bg-surface p-3 text-zinc-900"
            placeholder="How can I get more explosive with my swing?"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          About your training / follow-up details
          <textarea
            maxLength={3000}
            rows={4}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="block w-full rounded-xl border border-zinc-300 bg-surface p-3 text-zinc-900"
            placeholder="Your age, goal, equipment, weekly schedule, and any training restrictions. Add answers to follow-up questions here."
          />
        </label>
        <p className="text-xs text-zinc-600">
          This preview uses only what you enter here, not your health records or assigned workouts.
          Avoid including private medical details.
        </p>
        <button
          disabled={pending}
          className="min-h-11 rounded-full bg-brand-600 px-5 py-2 font-medium text-on-brand disabled:opacity-50"
        >
          {pending ? "Looking through the sources…" : answer ? "Update answer" : "Ask 9D"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>
      <div aria-live="polite" aria-busy={pending}>
        {answer ? (
          <article className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
            <p className="text-xs font-medium text-zinc-600">
              AI-assisted answer · curated-source preview
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
            {answer.questions.length ? (
              <section>
                <h2 className="font-semibold">A few details first</h2>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                  {answer.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-600">
                  Add your answers in the follow-up details box above.
                </p>
              </section>
            ) : null}
            {answer.draftPlan.length ? (
              <section>
                <h2 className="font-semibold">Draft for your coach</h2>
                <p className="text-sm text-zinc-600">
                  Discuss this with your coach before changing your training. This is not an
                  assigned workout.
                </p>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {answer.draftPlan.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            {answer.sourceIds.length ? (
              <section>
                <h2 className="font-semibold">Sources used</h2>
                {TRAINING_SOURCES.filter((source) => answer.sourceIds.includes(source.id)).map(
                  (source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-sm text-brand-700 underline"
                    >
                      {source.publisher}: {source.title}
                    </a>
                  ),
                )}
              </section>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}
