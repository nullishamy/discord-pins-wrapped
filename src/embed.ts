import { Message } from './schema.js'
import { getAvatarURL, getMessageLink } from './util.js'

export interface UrlBased<TUrl = string, TProxy = string | undefined> {
  url: TUrl
  proxy_url: TProxy
}

export interface Image extends UrlBased {
  height?: number
  width?: number
}

export interface Video extends UrlBased<string | undefined> {
  height?: number
  width?: number
}

export interface Footer extends UrlBased<string | undefined> {
  text: string
}

export interface Author {
  name: string
  url: string | undefined
  icon_url: string | undefined
  proxy_icon_url: string | undefined
}

export interface Field {
  name: string
  value: string
  inline: boolean
}

export interface Embed {
  title?: string
  type?: string
  description?: string
  url?: string
  timestamp?: string
  color?: number
  footer?: Footer
  image?: Image
  thumbnail?: Image
  video?: Video
  author?: Author
  fields?: Field[]
}

export interface FlaggedEmbed {
  embed: Embed
  source: string
  hasVideo: boolean
}

export function makeMessageEmbeds (messages: Message[]): FlaggedEmbed[] {
  return messages
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(p => {
      const embed: Embed = {
        timestamp: p.timestamp.toISOString(),
        footer: {
          text: 'Sent at',
          proxy_url: undefined,
          url: undefined
        }
      }
      let hasVideo = false

      if (p.content) {
        embed.description = p.content
        embed.description += '\n'
      }

      if (p.attachments.length) {
        const attachment = p.attachments[0]
        if (attachment.content_type.startsWith('image')) {
          embed.image = {
            url: attachment.url,
            proxy_url: undefined
          }
        } else if (attachment.content_type.startsWith('video')) {
          hasVideo = true
          embed.video = {
            url: attachment.url,
            proxy_url: undefined
          }
        } else {
          if (embed.description) {
            embed.description += `Unknown attachment [${attachment.filename}](${attachment.url})`
          } else {
            embed.description = `Unknown attachment [${attachment.filename}](${attachment.url})`
          }
        }
      }

      if (p.author.avatar) {
        embed.author = {
          name: `@${p.author.username}`,
          icon_url: getAvatarURL(p.author.id, p.author.avatar),
          url: undefined,
          proxy_icon_url: undefined
        }
      }

      if (embed.description) {
        embed.description += `
        [Jump](${getMessageLink(p)})
        `
      } else {
        embed.description = `[Jump](${getMessageLink(p)})`
      }

      return {
        embed,
        hasVideo,
        source: getMessageLink(p)
      }
    })
}
