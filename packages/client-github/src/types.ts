import { z } from "zod";

export const OODASchema = z.object({
    action: z.enum([
        "CREATE_ISSUE",
        "NOTHING",
        "ADD_COMMENT_TO_ISSUE",
        // "COMMENT_PR",
        "INITIALIZE_REPOSITORY",
        // "CREATE_COMMIT",
        "CREATE_MEMORIES_FROM_FILES",
        // "CREATE_PULL_REQUEST",
        // "MODIFY_ISSUE",
    ]),
    owner: z.string().optional(),
    repo: z.string().optional(),
    path: z.string().optional(),
    branch: z.string().optional(),
    title: z.string().min(1, "Pull request title is required").optional(),
    description: z.string().optional(),
    files: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
    message: z.string().optional(),
    labels: z.array(z.string()).optional(),
    issue: z.number().optional(),
    reasoning: z.string().optional(),
})

export interface OODAContent {
    action: string;
    owner?: string;
    repo?: string;
    path?: string;
    branch?: string;
    title: string;
    description?: string;
    files: { path: string; content: string }[];
    message?: string;
    labels?: string[];
    issue?: number;
    reasoning?: string;
}

export const isOODAContent = (
    object: any
): object is OODAContent => {
    return OODASchema.safeParse(object).success;
};