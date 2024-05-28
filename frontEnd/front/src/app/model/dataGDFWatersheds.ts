export default class dataGDFWatersheds {
    index : string;
    name: string;
    geometry_area: number;
    hydro_area: number;
    K1: any;
    geometry: any;
    min_lon : number;
    min_lat : number;
    max_lon : number;
    max_lat: number;
  
    constructor(index: string, name: string, geometry_area: number, hydro_area: number,K1: any, geometry: any, min_lon : number , min_lat: number, max_lon: number, max_lat: number) {
        this.index = index;
        this.name = name;
        this.geometry_area = geometry_area;
        this.hydro_area = hydro_area;
        this.K1 = K1;
        this.geometry = geometry;
        this.min_lon = min_lon;
        this.min_lat = min_lat;
        this.max_lon = max_lon;
        this.max_lat = max_lat;
    }
  }

  