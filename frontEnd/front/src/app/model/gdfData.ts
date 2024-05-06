export default class gdfData {
    index : string;
    name: string;
    geometry_area: number;
    hydro_area: number;
    K1: any;
    geometry: any;
  
    constructor(index: string, name: string, geometry_area: number, hydro_area: number,K1: any, geometry: any) {
        this.index = index;
        this.name = name;
        this.geometry_area = geometry_area;
        this.hydro_area = hydro_area;
        this.K1 = K1;
        this.geometry = geometry;
    }
  }

  