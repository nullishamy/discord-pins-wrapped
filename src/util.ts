import { Channel, Message } from './schema.js'

export const ZWS = '​'

export const sleep = async (time: number): Promise<void> => await new Promise((resolve) => setTimeout(resolve, time))

export function getPinsForUser (channel: Channel, userId: string): Message[] {
  return channel.pins.filter(p => p.author.id === userId)
}

export function getMessageLink (p: Message): string {
  return `https://discord.com/channels/856662493778018335/${p.channel_id}/${p.id}`
}

export function getAvatarURL (id: string, hash: string): string {
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.png`
}
