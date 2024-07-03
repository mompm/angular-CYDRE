class dataGDFStation {
    index : any;
    name : any;
    station_name : any;
    hydro_link : any;
    BSS_name : any;
    BSS_ID : any;
    x_outlet: any;
    y_outlet: any;
    area :any;
    geometry: any;
    typology: any;

    constructor(index : any, name: any, station_name : any, hydro_link :any,BSS_name : any,BSS_ID : any, x_outlet : any , y_outlet : any, area : any, geometry : any, typology : any ) {
        this.index = index;
        this.name = name;
        this.station_name = station_name;
        this.hydro_link =hydro_link;
        this.BSS_name = BSS_name;
        this.BSS_ID = BSS_ID;
        this.x_outlet = x_outlet;
        this.y_outlet = y_outlet;
        this.area = area;  
        this.geometry = geometry;
        this.typology = typology;
    }
}
export default dataGDFStation ;