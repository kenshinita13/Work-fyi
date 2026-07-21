"use client";

import { useActionState } from "react";

import {
  FieldError,
  FormFeedback,
  SubmitButton,
} from "@/components/auth/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboardingAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

const roles = [
  ["virtual_assistant", "Virtual assistant"],
  ["freelancer", "Freelancer"],
  ["cybersecurity_specialist", "Cybersecurity specialist"],
  ["project_manager", "Project manager"],
  ["administrator", "Administrator"],
  ["other", "Other"],
] as const;

const useCases = [
  ["virtual_assistance", "Virtual assistance"],
  ["freelancing", "Freelancing"],
  ["cybersecurity", "Cybersecurity"],
  ["project_management", "Project management"],
  ["administration", "Administration"],
  ["personal_productivity", "Personal productivity"],
] as const;

export function OnboardingForm({
  defaultFullName,
}: {
  defaultFullName?: string;
}) {
  const [state, action] = useActionState(
    completeOnboardingAction,
    initialFormState,
  );
  const localTimezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={defaultFullName}
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
          required
        />
        <FieldError errors={state.fieldErrors?.fullName} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="workspaceName">Workspace name</Label>
        <Input
          id="workspaceName"
          name="workspaceName"
          placeholder="Acme Operations"
          aria-invalid={Boolean(state.fieldErrors?.workspaceName)}
          required
        />
        <FieldError errors={state.fieldErrors?.workspaceName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="primaryRole">Primary role</Label>
          <Select name="primaryRole" required>
            <SelectTrigger id="primaryRole" className="w-full">
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={state.fieldErrors?.primaryRole} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="primaryUseCase">Primary use case</Label>
          <Select name="primaryUseCase" required>
            <SelectTrigger id="primaryUseCase" className="w-full">
              <SelectValue placeholder="Choose a use case" />
            </SelectTrigger>
            <SelectContent>
              {useCases.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={state.fieldErrors?.primaryUseCase} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="timezone">Time zone</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={localTimezone}
          aria-invalid={Boolean(state.fieldErrors?.timezone)}
          required
        />
        <FieldError errors={state.fieldErrors?.timezone} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton>Create workspace</SubmitButton>
    </form>
  );
}
