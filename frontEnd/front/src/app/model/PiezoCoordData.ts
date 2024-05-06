class PiezoCoordData {
    identifiant_BSS : string;
    x_wgs84 : number;
    y_wgs84 : number;

    constructor(identifiant_BSS : string, x_wgs84 : number, y_wgs84 : number ) {

      this.identifiant_BSS = identifiant_BSS;
      this.x_wgs84 = x_wgs84;
      this.y_wgs84 = y_wgs84;
    }
}

export default PiezoCoordData ;

