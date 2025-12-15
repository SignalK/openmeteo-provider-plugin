/*******************************
    Unit Conversion Class Module       
*******************************/

export class Convert {
  // ******* Temperature **********
  static celciusToKelvin(val = 0) {
    return val + 273.15
  }

  //******** Angles ***************
  static degreesToRadians(val = 0) {
    return (val * Math.PI) / 180
  }

  static radiansToDegrees(val = 0) {
    return (val * 180) / Math.PI
  }

  //******** Pressure ***************
  static hPaToPa(val = 0) {
    return val * 100
  }

  // ******* Distance / Speed ********

  //** km/h to m/sec **
  static kmhToMsec(val: number): number {
    return val / 3.6
  }

  //** mm to m **
  static mmToM(val: number): number {
    return val / 1000
  }

  static toRatio(val: number): number {
    return val / 100
  }

  static fromUnixTime(val: number): number {
    return val * 1000
  }

  // ******* Geohash ********
  static geohash(lat: number, lon: number, precision = 5): string {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    let minLat = -90,
      maxLat = 90
    let minLon = -180,
      maxLon = 180
    let hash = ''
    let isEven = true
    let bit = 0
    let ch = 0

    while (hash.length < precision) {
      if (isEven) {
        const mid = (minLon + maxLon) / 2
        if (lon >= mid) {
          ch |= 1 << (4 - bit)
          minLon = mid
        } else {
          maxLon = mid
        }
      } else {
        const mid = (minLat + maxLat) / 2
        if (lat >= mid) {
          ch |= 1 << (4 - bit)
          minLat = mid
        } else {
          maxLat = mid
        }
      }
      isEven = !isEven
      if (bit < 4) {
        bit++
      } else {
        hash += base32[ch]
        bit = 0
        ch = 0
      }
    }
    return hash
  }
}
