import fetch from 'node-fetch'
import { z } from 'zod'
import { Arguments } from './index.js'
import { Message, DiscordError } from './schema.js'
import { sleep } from './util.js'

export async function fetchPins (id: string, token: string): Promise<{
  ok: true
  val: Message[]
} | {
  ok: false
  val: DiscordError
}> {
  const res = await fetch(`https://discord.com/api/v9/channels/${id}/pins`, {
    headers: {
      authorization: token
    },
    body: null,
    method: 'GET'
  }).then(async res => await res.json() as any)

  if (res.code !== undefined) {
    return {
      ok: false,
      val: DiscordError.parse(res)
    }
  }

  return {
    ok: true,
    val: z.array(Message).parse(res)
  }
}

export async function fetchChannel (id: string, args: Arguments): Promise<{
  ok: true
  val: {
    id: string
    pins: Message[]
  }
} | {
  ok: false
  err: {
    channel_id: string
    cause: DiscordError
  }
}> {
  console.debug('Fetching channel', id)
  const pinResult = await fetchPins(id, args.token)

  if (!pinResult.ok) {
    const error = pinResult.val
    if (error.retry_after) {
      const retry = error.retry_after + 0.5
      console.debug('Sleeping for', retry)
      await sleep(retry)
      console.debug('Slept for', retry, ', retrying')
      return await fetchChannel(id, args)
    }

    return {
      ok: false,
      err: {
        channel_id: id,
        cause: error
      }
    }
  } else {
    console.log('Got', pinResult.val.length, 'pins from', id)

    return {
      ok: true,
      val: {
        id,
        pins: pinResult.val
      }
    }
  }
}
