import { z } from "zod";
import { githubName } from "@/core/workflow";

export const createCaseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter the person’s name.")
    .max(120, "Use 120 characters or fewer."),
  departureOn: z.iso.date({ error: "Choose a valid departure date." }),
  username: githubName,
});
export type CreateCaseValues = z.input<typeof createCaseSchema>;
export type CreateCaseState = {
  values: CreateCaseValues;
  fieldErrors: Partial<Record<keyof CreateCaseValues, string[]>>;
  message?: string;
};
export const initialCreateCaseState: CreateCaseState = {
  values: { fullName: "", departureOn: "", username: "" },
  fieldErrors: {},
};
