/* eslint-disable @typescript-eslint/no-redeclare */
import { z } from 'zod'

export const Author = z.object({
  id: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  discriminator: z.string(),
  public_flags: z.number(),
  global_name: z.string()
})

export const Attachment = z.object({
  id: z.string(),
  content_type: z.string(),
  filename: z.string(),
  url: z.string(),
  proxy_url: z.string()
})

export const Message = z.object({
  id: z.string(),
  type: z.number(),
  content: z.string(),
  channel_id: z.string(),
  author: Author,
  mentions: z.array(Author),
  mention_roles: z.array(z.any()),
  pinned: z.boolean(),
  mention_everyone: z.boolean(),
  tts: z.boolean(),
  timestamp: z.string().transform(a => new Date(a)),
  edited_timestamp: z.string().transform(a => new Date(a)).nullable(),
  flags: z.number(),
  attachments: z.array(Attachment)
})

export const Channel = z.object({
  id: z.string(),
  pins: z.array(Message)
})

export const DiscordError = z.object({
  code: z.number(),
  retry_after: z.number().optional()
}).passthrough()

export type Channel = z.infer<typeof Channel>
export type Message = z.infer<typeof Message>
export type Attachment = z.infer<typeof Attachment>
export type DiscordError = z.infer<typeof DiscordError>
