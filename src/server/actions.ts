"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { githubName, providerId } from "@/core/workflow";
import {
  createCaseSchema,
  type CreateCaseState,
} from "@/features/offboarding/create-case-state";
import { requireAdministrator } from "./auth";
import { sendApprovalEmail } from "./approval-email";

async function perform(
  name: string,
  parameters: Record<string, unknown>,
  destination: string,
) {
  const { client } = await requireAdministrator();
  const { data, error } = await client.rpc(name, parameters);
  if (error) redirect(`${destination}?error=operation`);
  revalidatePath("/", "layout");
  return data;
}

export async function createCase(
  _previousState: CreateCaseState,
  formData: FormData,
): Promise<CreateCaseState> {
  const { client } = await requireAdministrator();
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    departureOn: String(formData.get("departureOn") ?? ""),
    username: String(formData.get("username") ?? ""),
  };
  const parsed = createCaseSchema.safeParse(values);
  if (!parsed.success)
    return {
      values,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      message: "Check the highlighted field. Your input has been kept.",
    };
  const { data: caseId, error } = await client.rpc("offboard_create_case", {
    p_name: parsed.data.fullName,
    p_departure: parsed.data.departureOn,
    p_username: parsed.data.username,
  });
  if (error)
    return {
      values,
      fieldErrors: {},
      message:
        "The case could not be saved. Your input has been kept; please try again.",
    };
  revalidatePath("/", "layout");
  redirect(`/people/${z.uuid().parse(caseId)}`);
}
export async function connectGitHub(formData: FormData) {
  const organization = githubName.safeParse(formData.get("organization"));
  if (!organization.success) redirect("/integrations?error=input");
  await perform(
    "offboard_connect_github",
    { p_organization: organization.data },
    "/integrations",
  );
  redirect("/integrations");
}
export async function requestScan(formData: FormData) {
  const values = z
    .object({ caseId: z.uuid(), integrationId: z.uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!values.success) redirect("/people?error=input");
  const destination = `/people/${values.data.caseId}`;
  await perform(
    "offboard_request_scan",
    {
      p_case_id: values.data.caseId,
      p_integration_id: values.data.integrationId,
    },
    destination,
  );
  redirect(destination);
}
export async function confirmIdentity(formData: FormData) {
  const values = z
    .object({
      caseId: z.uuid(),
      identityId: z.uuid(),
      providerUserId: providerId,
    })
    .safeParse(Object.fromEntries(formData));
  if (!values.success) redirect("/people?error=input");
  const destination = `/people/${values.data.caseId}`;
  await perform(
    "offboard_confirm_identity",
    {
      p_identity_id: values.data.identityId,
      p_provider_user_id: values.data.providerUserId,
    },
    destination,
  );
  redirect(destination);
}
export async function decideRemoval(formData: FormData) {
  const values = z
    .object({
      caseId: z.uuid(),
      findingId: z.uuid(),
      decision: z.enum(["approved", "rejected"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!values.success) redirect("/people?error=input");
  if (
    values.data.decision === "approved" &&
    formData.get("acknowledged") !== "yes"
  )
    redirect(`/people/${values.data.caseId}?error=input`);
  const destination = `/people/${values.data.caseId}`;
  await perform(
    "offboard_decide_removal",
    { p_finding_id: values.data.findingId, p_decision: values.data.decision },
    destination,
  );
  redirect(destination);
}

export async function requestApprovalEmail(formData: FormData) {
  const values = z
    .object({ caseId: z.uuid(), findingId: z.uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!values.success) redirect("/people?error=input");
  const destination = `/people/${values.data.caseId}`;
  try {
    await sendApprovalEmail(values.data.findingId);
  } catch {
    redirect(`${destination}?error=email`);
  }
  revalidatePath("/", "layout");
  redirect(destination);
}
