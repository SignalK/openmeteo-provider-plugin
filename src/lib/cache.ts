import { Position } from '@signalk/server-api'
import { isPointInPolygon } from 'geolib'
import * as geohash from 'ngeohash'
import { constants } from 'fs'
import { access, mkdir, readdir, rm, readFile, writeFile } from 'fs/promises'
import path from 'path'

//************ Signal K Weather API ****************
import { WeatherProviderData } from './mock-weather-api'
// *************************************************

interface CacheEntry {
  updated: string
  lastRequest: string
}

export class WCache {
  private _maxAge = 60 // minutes

  private entries: {
    [key: string]: CacheEntry
  }

  private fpath!: string

  constructor(basePath: string) {
    this.entries = {}
    this.initStorage(basePath)
  }

  // max age of cache entry before a re-fetch is required
  set maxAge(value: number) {
    if (value >= 1) {
      this._maxAge = value
    }
  }

  // ************** Cache Storage Methods ****************

  private async initStorage(basePath: string) {
    this.fpath = path.join(basePath, 'cache')
    try {
      await access(this.fpath, constants.W_OK | constants.R_OK)
    } catch (error) {
      try {
        await mkdir(this.fpath, { recursive: true })
      } catch (error) {
        throw new Error(`Unable to create ${this.fpath}!`)
      }
    }
    // purge files
    try {
      await this.purgeStorage()
      this.entries = {}
    } catch (error) {
      throw new Error(`Error purging files! (${this.fpath})`)
    }
  }

  private async purgeStorage() {
    const files = await readdir(this.fpath)
    files.forEach((f) => {
      rm(path.join(this.fpath, f))
    })
  }

  private async removeStoreEntry(id: string) {
    rm(path.join(this.fpath, id))
  }

  private async writeStoreEntry(id: string, value: WeatherProviderData) {
    writeFile(path.join(this.fpath, id), JSON.stringify(value))
  }

  private async readStoreEntry(id: string) {
    return JSON.parse(await readFile(path.join(this.fpath, id), 'utf8'))
  }
  // *************************************************

  public async setEntry(id: string, value: WeatherProviderData) {
    try {
      await this.writeStoreEntry(id, value)
      this.entries[id] = {
        updated: new Date().toISOString(),
        lastRequest: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Error writing entry! (${id})`)
    }
  }

  public async getEntry(id: string): Promise<WeatherProviderData> {
    try {
      this.entries[id].lastRequest = new Date().toISOString()
      return await this.readStoreEntry(id)
    } catch (error) {
      throw new Error(`Error retrieving entry! (${id})`)
    }
  }

  public async deleteEntry(id: string) {
    try {
      await this.removeStoreEntry(id)
      delete this.entries[id]
    } catch (error) {
      throw new Error(`Error deleting entry! (${id})`)
    }
  }

  /**
   * Return the index containing the supplied position
   * @params position
   * @returns index key | undefined
   */
  public contains(position: Position): string | undefined {
    let ghash!: string
    if (
      typeof position.latitude === 'number' &&
      typeof position.longitude === 'number'
    ) {
      Object.keys(this.entries).forEach((g: string) => {
        const bbox = geohash.decode_bbox(g)
        if (
          isPointInPolygon(position, [
            { latitude: bbox[0], longitude: bbox[1] },
            { latitude: bbox[2], longitude: bbox[1] },
            { latitude: bbox[2], longitude: bbox[3] },
            { latitude: bbox[0], longitude: bbox[3] }
          ])
        ) {
          ghash = ghash ?? g
        }
      })
    }

    if (ghash && ghash in this.entries) {
      const d = this.timeDiff(this.entries[ghash].updated)
      return d > this._maxAge ? undefined : ghash
    } else {
      return
    }
  }

  /**
   * Return difference between times in minutes (dt2- dt1)
   *  @params dt1: ISO String date /time
   *  @params dt2: ISO String date /time (defaults to Date.now() if not supplied)
   */
  private timeDiff(dt1: string, dt2?: string): number {
    const vt2: number = dt2 ? new Date(dt2).valueOf() : Date.now()
    const vt1 = new Date(dt1).valueOf()
    return Math.abs((vt2 - vt1) / 60000)
  }
}
