import fetch from 'node-fetch'
import { Embed } from './embed.js'

export async function sendWebhook (url: string, embeds?: Embed[], content?: string): Promise<string> {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      embeds,
      content
    })
  }).then(async res => await res.text())
}
