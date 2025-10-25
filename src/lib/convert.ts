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
}
