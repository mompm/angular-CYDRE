class OldBSSData {
    X_WGS84: string;
    Y_WGS84 : string;
    Identifiant_BSS : string;
    Ancien_code_national_BSS : string ;

    constructor(X_WGS84: string, Y_WGS84: string, Identifiant_BSS: string, Ancien_code_national_BSS: string) {

      this.X_WGS84 = X_WGS84;
      this.Y_WGS84 = Y_WGS84;
      this.Identifiant_BSS = Identifiant_BSS;
      this.Ancien_code_national_BSS = Ancien_code_national_BSS;

    }
}

export default OldBSSData ;

