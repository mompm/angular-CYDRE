class DFFData {
    index : string;
    name : string;
    area : number;
    x_wgs84: number;
    y_wgs84: number;
    min_lon : number;
    min_lat : number;
    max_lon : number;
    max_lat: number;

    constructor(index : string, name : string, area : number, x_wgs84 : number, y_wgs84 : number, min_lon : number , min_lat: number, max_lon: number, max_lat: number) {

      this.index = index;
      this.name = name;
      this.area = area;
      this.x_wgs84 = x_wgs84;
      this.y_wgs84 = y_wgs84;
      this.min_lon = min_lon;
      this.min_lat = min_lat;
      this.max_lon = max_lon;
      this.max_lat = max_lat;
    }
}

export default DFFData ;

