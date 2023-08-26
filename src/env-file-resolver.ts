import fs from 'fs/promises'
import { Resolver } from 'args.ts'

export class EnvFileResolver extends Resolver {
  private map: Record<string, string> = {}
  private initd = false

  constructor (id: string, private readonly path: string) {
    super(id)
  }

  async init (): Promise<this> {
    this.map = this.parse(await fs.readFile(this.path, 'utf-8'))
    this.initd = true
    return this
  }

  private parse (content: string): Record<string, string> {
    const out: Record<string, string> = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const [key, value] = line.split(/\s*=\s*/)
      out[key.toLowerCase()] = value
    }

    return out
  }

  keyExists (key: string): boolean {
    if (!this.initd) {
      throw new TypeError('Not initialised')
    }
    return !!this.map[key]
  }

  resolveKey (key: string): string | undefined {
    if (!this.initd) {
      throw new TypeError('Not initialised')
    }
    return this.map[key]
  }
}
