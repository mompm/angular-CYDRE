
class dataGDFPiezometry  {
    identifiant_BSS : any;
    x_wgs84 : any;
    y_wgs84 : any;
    oldBSS : any;
    Nom : any;
    geometry : any;


    constructor(identifiant_BSS : any, x_wgs84 : any, y_wgs84 : any,oldBSS :any,Nom : any ,geometry : any) {

      this.identifiant_BSS = identifiant_BSS;
      this.x_wgs84 = x_wgs84;
      this.y_wgs84 = y_wgs84;
      this.oldBSS = oldBSS;
      this.Nom = Nom;
      this.geometry = geometry;
    }
}
export default dataGDFPiezometry ;


