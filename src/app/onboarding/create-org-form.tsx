"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { slugify } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOrganization } from "./actions";

export function CreateOrgForm() {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Organization name"
        name="name"
        placeholder="Central High Baseball"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        required
      />
      <Field
        label="URL"
        name="slug"
        placeholder="central-high-baseball"
        value={slug}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(slugify(e.target.value));
        }}
        hint="Lowercase letters, numbers, and dashes."
        required
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create organization
      </SubmitButton>
    </form>
  );
}
