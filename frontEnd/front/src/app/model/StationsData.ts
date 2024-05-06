class StationsData {
    Area: number;
    ID: string;
    name: string;
    x_outlet: number;
    y_outlet: number;
  
    constructor(name: string, ID: string, x_outlet: number, y_outlet: number, Area: number) {
      this.name = name;
      this.ID = ID;
      this.x_outlet = x_outlet;
      this.y_outlet = y_outlet;
      this.Area = Area;
  }
  }
  
  export default StationsData ;