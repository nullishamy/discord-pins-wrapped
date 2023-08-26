#!/usr/bin/env node

import { a, Args, ParserOpts, util } from 'args.ts'
import { ExtractArgType } from 'args.ts/lib/internal/types'
import fetch from 'node-fetch'
import { makeMessageEmbeds, FlaggedEmbed } from './embed.js'
import { EnvFileResolver } from './env-file-resolver.js'
import { fetchChannel } from './fetchers.js'
import { getPinsForUser } from './util.js'

const DEFAULT_CHANNELS = [
  '960951177212743680', // #general-archived-1
  '1005593218466983957', // #general-archived-2
  '1077689138679119872', // #general-archived-3
  '1119380195758047252', // #general-archived-4
  '1137476424287125546' // #general
]

const opts: ParserOpts = {
  programName: 'pins',
  programDescription: 'Collate and publish Discord pins',
  environmentPrefix: 'PIN'
}

const parser = new Args(opts)
  .arg(['--dry-run'], a.bool())
  .arg(['--webhook'], a.string().requireUnlessPresent('--dry-run'))
  .arg(['--token'], a.string())
  .arg(['--channels'], a.string().array().default(DEFAULT_CHANNELS))
  .arg(['--user'], a.string().optional())
  .arg(['--limit'], a.number().optional())

export type Arguments = ExtractArgType<typeof parser>

async function handleChannel (id: string, args: Arguments): Promise<void> {
  const parsed = await fetchChannel(id, args)

  if (parsed.ok) {
    const channel = parsed.val

    let filteredPins = channel.pins
    if (args.user !== undefined) {
      console.log('Filtering pins by user', args.user)

      filteredPins = getPinsForUser(channel, '637032376731566082')
    } else {
      console.log('Using all pins from channel')
    }

    const embeds = makeMessageEmbeds(filteredPins)

    const videos: FlaggedEmbed[] = []
    const text: FlaggedEmbed[] = []

    for (const embed of embeds.slice(0, args.limit ?? embeds.length)) {
      if (embed.hasVideo) {
        videos.push(embed)
      } else {
        text.push(embed)
      }
    }

    console.log('Filtered', videos.length, 'videos,', text.length, 'text posts out of', embeds.length, 'embeds, limited to', args.limit ?? embeds.length, 'embeds')

    const chunkSize = 10
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize)

      const body = JSON.stringify({
        embeds: chunk.map(t => t.embed)
      }, undefined, 2)

      if (args['dry-run']) {
        console.log('Would have sent body (text):', body)
        break
      }

      const webhookResult = await fetch(args.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: chunk.map(t => t.embed)
        })
      }).then(async res => await res.text())

      console.log('text send:', webhookResult)
    }

    if (videos.length) {
      const body = JSON.stringify({
        content: videos.map((v, i) => `[Clip ${i + 1}](${v.embed.video?.url}) - [Jump](${v.source}) to <#${v.message.channel_id}>`).join('\n')
      }, undefined, 2)

      if (args['dry-run']) {
        console.log('Would have sent body (clips):', body)
        return
      }

      const webhookResult = await fetch(args.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      }).then(async res => await res.text())

      console.log('clip send:', webhookResult)
    }

    console.log('Finished processing', id)
  } else {
    const errors = parsed.err
    console.error('Discord errors:', JSON.stringify(errors, undefined, 2))
  }
}

async function main (): Promise<void> {
  parser.middleware(await new EnvFileResolver('env-file', '.env').init())

  const result = util.exitOnFailure(await parser.parse(util.makeArgs()))

  if (result.mode !== 'args') {
    console.error('Error parsing args')
    process.exit(1)
  }

  const args = result.args

  console.log('Operating with', args.channels.length, 'channels:', args.channels)
  for (const channel of args.channels) {
    await handleChannel(channel, args)
    console.log('-- -- --')
  }
}

main().catch(console.error)
