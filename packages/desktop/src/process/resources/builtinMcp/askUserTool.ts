/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure definition of the `ask_user` MCP tool: schema, description and result
 * builder. Kept separate from the stdio server so it can be unit tested
 * without booting an MCP transport.
 */

import { z } from 'zod';

export const ASK_USER_OPTION_SCHEMA = z
  .object({
    label: z.string().min(1).describe('Short label shown as a selectable option.'),
    description: z.string().optional().describe('Optional one-line explanation shown under the label.'),
  })
  .describe('A selectable answer for the question.');

export const ASK_USER_QUESTION_SCHEMA = z
  .object({
    header: z
      .string()
      .optional()
      .describe('Optional short category label, e.g. "Deployment" or "Data model". Keep it under ~24 characters.'),
    question: z.string().min(1).describe('The question to ask the user. State exactly what decision is needed.'),
    multiSelect: z
      .boolean()
      .optional()
      .describe('Set to true when the user may pick more than one option. Defaults to false.'),
    options: z.array(ASK_USER_OPTION_SCHEMA).min(2).describe('Between 2 and 4 options the user can choose from.'),
  })
  .describe('A single question with its selectable options.');

export const ASK_USER_SCHEMA = {
  questions: z
    .array(ASK_USER_QUESTION_SCHEMA)
    .min(1)
    .describe('The questions to ask. Ask at most 4 questions in one call.'),
};

/**
 * Tool description shown to the model. The wording is deliberately
 * imperative: the tool exists to make the agent stop and confirm design
 * decisions instead of silently picking one.
 */
export const ASK_USER_TOOL_DESCRIPTION = `Ask the user a question and wait for their answer before continuing.

Use this tool when a decision would materially change the work and you cannot infer the answer from the request, the workspace, or the existing code. Typical cases:
- Architecture or technology choices that are expensive to reverse
- Scope boundaries ("should this also handle X?")
- Data model / API shape decisions the user has an opinion about
- Anything you would otherwise have to guess, where guessing wrong wastes a lot of work

Rules:
- Call this BEFORE implementing anything that depends on the answer.
- Give 2-4 concrete options per question. Make them mutually exclusive and specific.
- Keep each option label short. Put the reasoning in the option description.
- Ask at most 4 questions in one call. Batch related decisions together.
- Do NOT use this tool for factual lookups you can answer yourself, for trivial
  preferences, or to confirm steps the user already gave you.

CRITICAL - what to do after calling this tool:
The questions are rendered to the user as an interactive card in the chat. You MUST end your turn immediately after this call and wait for the user's reply. Do NOT continue the task, do NOT write files, and do NOT run commands until the user has answered. If you keep working without the answer, you risk building the wrong thing.`;

export const ASK_USER_TOOL_RESULT_TEXT = `The questions were delivered to the user as an interactive card in the chat.

You MUST now end your turn and wait for the user's answer. Do not continue the task, do not write any files, and do not run any commands until the user replies. If the user answers in a later message, continue from that answer.`;

/**
 * Build the tool result returned to the agent.
 *
 * The tool deliberately does NOT block: the question card is rendered from the
 * tool call itself in the chat, and the user's answer arrives as the next
 * user message. The result text carries the "stop and wait" instruction so
 * the agent ends its turn instead of continuing on assumptions.
 */
export function buildAskUserToolResult(): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text' as const, text: ASK_USER_TOOL_RESULT_TEXT }],
  };
}
