import path from "path";
import fs from "fs/promises";
import { createHash } from "crypto";
import {
    composeContext,
    elizaLogger,
    generateObjectV2,
    stringToUuid,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    Plugin,
    State,
} from "@ai16z/eliza";
import { createMemoriesFromFilesTemplate } from "../templates";
import {
    CreateMemoriesFromFilesContent,
    CreateMemoriesFromFilesSchema,
    isCreateMemoriesFromFilesContent,
} from "../types";
import { getRepoPath, retrieveFiles } from "../utils";
import { sourceCodeProvider } from "../providers/sourceCode";
import { testFilesProvider } from "../providers/testFiles";
import { workflowFilesProvider } from "../providers/workflowFiles";
import { documentationFilesProvider } from "../providers/documentationFiles";
import { releasesProvider } from "../providers/releases";

export async function addFilesToMemory(
    runtime: IAgentRuntime,
    message: Memory,
    files: string[],
    repoPath: string,
    owner: string,
    repo: string
) {
    elizaLogger.info("Adding files to memory:", files);
    for (const file of files) {
        const relativePath = path.relative(repoPath, file);
        // read file and escape new lines with \n
        const content = (await fs.readFile(file, "utf-8")).replace(
            /\n/g,
            "\\n"
        );
        const contentHash = createHash("sha256").update(content).digest("hex");
        const memoryId = stringToUuid(
            `github-${owner}-${repo}-${relativePath}-${contentHash}`
        );
        const roomId = stringToUuid(`github-${owner}-${repo}`);

        elizaLogger.info("Memory ID:", memoryId);
     const existingDocument =
            await runtime.messageManager.getMemoryById(memoryId);

        elizaLogger.log("existingDocument", existingDocument);

        if (
            existingDocument &&
            existingDocument.content["hash"] == contentHash
        ) {
            continue;
        }

        elizaLogger.log(
            "Processing knowledge for ",
            runtime.character.name,
            " - ",
            relativePath
        );
        const memory = {
            id: memoryId,
            userId: message.userId,
            agentId: message.agentId,
            roomId: roomId,
            content: {
                text: content,
                hash: contentHash,
                source: "github",
                attachments: [],
                metadata: {
                    path: relativePath,
                    repo,
                    owner,
                },
            },
        } as Memory;
        elizaLogger.info("Memory:", memory);
        await runtime.messageManager.createMemory(memory);
    }
}

export const createMemoriesFromFilesAction: Action = {
    name: "CREATE_MEMORIES_FROM_FILES",
    similes: [
        "CREATE_MEMORIES_FROM_FILES",
        "CREATE_MEMORIES",
        "CREATE_MEMORIES_FROM_FILE",
        "MEMORIES_FROM_FILES",
        "MEMORIES_FROM_FILE",
        "GITHUB_CREATE_MEMORIES_FROM_FILES",
        "GITHUB_CREATE_MEMORIES",
        "GITHUB_CREATE_MEMORIES_FROM_FILE",
        "GITHUB_MEMORIES_FROM_FILES",
        "GITHUB_MEMORIES_FROM_FILE",
    ],
    description: "Create memories from files in the repository",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");

        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("[createMemoriesFromFiles] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: createMemoriesFromFilesTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
            schema: CreateMemoriesFromFilesSchema,
        });

        if (!isCreateMemoriesFromFilesContent(details.object)) {
            throw new Error("Invalid content");
        }

        const content = details.object as CreateMemoriesFromFilesContent;

        elizaLogger.info("Creating memories from files...");

        const repoPath = getRepoPath(content.owner, content.repo);
        elizaLogger.info(`Repo path: ${repoPath}`);
        try {
            const files = await retrieveFiles(repoPath, content.path);
            elizaLogger.info(`Files: ${files}`);
            await addFilesToMemory(
                runtime,
                message,
                files,
                repoPath,
                content.owner,
                content.repo
            );

            elizaLogger.info("Memories created successfully!");

            callback({
                text: "Memories created successfully!",
                attachments: [],
            });
        } catch (error) {
            elizaLogger.error(
                `Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}:`,
                error
            );
            callback(
                {
                    text: `Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}. Please try again.`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create memories from files on repository octocat/hello-world at path 'docs/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "CREATE_MEMORIES_FROM_FILES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create memories from repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "CREATE_MEMORIES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create memories from file in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "CREATE_MEMORIES_FROM_FILE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Memories from files in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "MEMORIES_FROM_FILES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Memories from file in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "MEMORIES_FROM_FILE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub create memories from files in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "GITHUB_CREATE_MEMORIES_FROM_FILES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub create memories in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "GITHUB_CREATE_MEMORIES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub create memories from file in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "GITHUB_CREATE_MEMORIES_FROM_FILE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub memories from files in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "GITHUB_MEMORIES_FROM_FILES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub memories from file in repository octocat/hello-world",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "GITHUB_MEMORIES_FROM_FILE",
                },
            },
        ],
    ],
};

export const githubCreateMemorizeFromFilesPlugin: Plugin = {
    name: "githubCreateMemorizeFromFiles",
    description: "Integration with GitHub for creating memories from files",
    actions: [createMemoriesFromFilesAction],
    evaluators: [],
    providers: [
        // sourceCodeProvider,
        // testFilesProvider,
        // workflowFilesProvider,
        // documentationFilesProvider,
        // releasesProvider,
    ],
};
