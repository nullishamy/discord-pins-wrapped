#!/usr/bin/env node

import { a, Args, ParserOpts, util } from 'args.ts'
import { ExtractArgType } from 'args.ts/lib/internal/types'
import { makeMessageEmbeds, FlaggedEmbed, makeLeaderboardEmbed, makeFirstPinsEmbeds } from './embed.js'
import { EnvFileResolver } from './env-file-resolver.js'
import { fetchChannel, fetchPins } from './fetchers.js'
import { Message } from './schema'
import { getPinsForUser, ZWS } from './util.js'
import { sendWebhook } from './webhook.js'

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
  .arg(['--user-count'], a.bool().dependsOn('--user'))
  .arg(['--limit'], a.number().optional())
  .arg(['--leaderboard'], a.bool().conflictsWith('--user').conflictsWith('--user-count'))
  .arg(['--first-pin'], a.bool().conflictsWith('--leaderboard'))

export type Arguments = ExtractArgType<typeof parser>

async function handleChannel (id: string, args: Arguments): Promise<void> {
  const parsed = await fetchChannel(id, args)

  if (parsed.ok) {
    const channel = parsed.val

    let filteredPins = channel.pins
    if (args.user !== undefined) {
      console.log('Filtering pins by user', args.user)

      filteredPins = getPinsForUser(channel, args.user)
    } else {
      console.log('Using all pins from channel')
    }

    if (args['user-count']) {
      console.log('Sending only the count for this user, which is', filteredPins.length)
      if (args['dry-run']) {
        console.log('Halting here')
        return
      }

      const username = filteredPins[0]?.author.username ?? 'unknown'
      const webhookResult = await sendWebhook(args.webhook, [
        {
          description: `User \`@${ZWS}${username}\` (${args.user}) has ${filteredPins.length} pins`,
          color: 0x8468c9
        }
      ])

      console.log('count send:', webhookResult)
      return
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

      const body = chunk.map(t => t.embed)

      if (args['dry-run']) {
        console.log('Would have sent body (text):', body)
        break
      }

      if (args['dry-run']) {
        console.log('Would have sent body (clips):', body)
        return
      }

      const webhookResult = await sendWebhook(args.webhook, body)

      console.log('text send:', webhookResult)
    }

    if (videos.length) {
      const body = videos
        .map((v, i) => `[Clip ${i + 1}](${v.embed.video?.url}) - [Jump](${v.source}) to <#${v.message.channel_id}>`)
        .join('\n')

      if (args['dry-run']) {
        console.log('Would have sent body (clips):', body)
        return
      }

      const webhookResult = await sendWebhook(args.webhook, undefined, body)
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
  const needsAllPins = args.leaderboard || args['first-pin']

  const allPins: Message[] = []

  if (needsAllPins) {
    for (const channel of args.channels) {
      const pins = await fetchPins(channel, args.token)
      if (!pins.ok) {
        console.error('Failed to fetch for', channel, ', skipping')
        continue
      }

      allPins.push(...pins.val)
    }
  }

  if (args.leaderboard) {
    console.log('Ranking leaderboard from', allPins.length, 'total pins')
    const leaderboard = makeLeaderboardEmbed(allPins, args.channels)

    if (args['dry-run']) {
      console.log('Would have sent body (leaderboard)', leaderboard)
      return
    }

    const webhookResult = await sendWebhook(args.webhook, [leaderboard])
    console.log('leaderboard send:', webhookResult)
    return
  }

  if (args['first-pin']) {
    console.log('Selecting first pins from', allPins.length, 'total pins')
    const firstPins = makeFirstPinsEmbeds(allPins)

    if (args['dry-run']) {
      console.log('Would have sent body (first-pin)', firstPins)
      return
    }

    const videos: Array<{ user: string, embed: FlaggedEmbed }> = []
    const text: Array<{ user: string, embed: FlaggedEmbed }> = []

    for (const [user, embed] of Object.entries(firstPins)) {
      if (embed.hasVideo) {
        videos.push({ user, embed })
      } else {
        text.push({ user, embed })
      }
    }

    const textBody = text.map(t => ({
      ...t.embed.embed,
      title: 'First pin'
    }))
    const videoBody = videos
      .map((v, i) => `[Clip ${i + 1}](${v.embed.embed.video?.url}) - [Jump](${v.embed.source}) to <#${v.embed.message.channel_id}>`)
      .join('\n')

    if (args['dry-run']) {
      console.log('Would have sent body (text):', textBody)
      console.log('Would have sent body (video):', videoBody)
      return
    }

    const webhookResult = await sendWebhook(args.webhook, textBody)

    console.log('text send:', webhookResult)

    if (videos.length) {
      const body = videos
        .map((v, i) => `[First clip](${v.embed.embed.video?.url}) - [Jump](${v.embed.source}) to <#${v.embed.message.channel_id}>`)
        .join('\n')

      const webhookResult = await sendWebhook(args.webhook, undefined, body)
      console.log('clip send:', webhookResult)
    }

    return
  }

  for (const channel of args.channels) {
    await handleChannel(channel, args)
    console.log('-- -- --')
  }
}

main().catch(console.error)
