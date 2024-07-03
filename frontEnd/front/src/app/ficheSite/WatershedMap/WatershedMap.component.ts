import { Component, Input, SimpleChanges, OnDestroy} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import dataGDFPiezometry from 'src/app/model/dataGDFPiezometry';
import dataGDFWatersheds from 'src/app/model/dataGDFWatersheds';
import dataGDFStation from 'src/app/model/dataGDFStation';

/**
 * 
 */
@Component({
    selector: 'app-WatershedMap',
    templateUrl: './WatershedMap.component.html',
    styleUrls: ['./WatershedMap.component.scss']
  })
  /**
   * 
   */
  export class WatershedMapComponent {
    private resizeListener: () => void;

    @Input() stationSelectionChange!: string;
    private WatershedMapLeaflet!: L.Map;
    MapExecutee = false; 
    DataGDFWatersheds: dataGDFWatersheds[]  = [];
    DataGDFPiezometry: dataGDFPiezometry [] = [];
    DataGDFStation: dataGDFStation[]  =[];

WaterShedsMapLayers = {
    "BaseMap" : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }),
    "ligthMap" : L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }),
    "RoadMapColor" : L.tileLayer('https://tile.geobretagne.fr/geopf/service?layer=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&style=&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=png&TileMatrix={z}&TileCol={x}&TileRow={y}', {
      attribution: '&copy; <a href="https://www.ign.fr/">IGN</a>'
    }),
    "RoadMapGrey" : L.tileLayer('https://tile.geobretagne.fr/osm/service?layer=osm:grey&style=&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=png&TileMatrix={z}&TileCol={x}&TileRow={y}', {
      attribution: '&copy; Données <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> mises en forme par <a href="https://www.osm.datagrandest.fr/">Data Grand Est</a>'
    }),
    "SatelliteMap": L.tileLayer('https://tile.geobretagne.fr/photo/service?layer=HR.ORTHOIMAGERY.ORTHOPHOTO&style=&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=png&TileMatrix={z}&TileCol={x}&TileRow={y}', {
      attribution: '&copy; <a href="https://www.ign.fr/">BD Ortho IGN</a> '
    })
  };
  /**
   * 
   * @param dataService 
   * @param jsonService 
   */
  constructor(private dataService: DataService,private jsonService: JsonService) {
    this.resizeListener = () => {
      this.WatershedMapLeaflet.invalidateSize();
    }; 
  }

    /**
     * 
     */
    ngOnInit() {
      this.initGDFWatersheds();
      this.initGDFPiezometry();
      this.initGDFStations();
    }

    ngOnDestroy(){
      window.removeEventListener('resize',this.resizeListener);
    }

    /**
     * 
     * @param changes 
     */
    ngOnChanges(changes: SimpleChanges) {
      // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
      // Vous pouvez y réagir en conséquence
      if (changes['stationSelectionChange']) {
        //console.log('La valeur de stationMap a changé :', changes['stationSelectionChange'].currentValue);
        this.MapExecutee = false;
        
      }
    }
       /**
        * 
        */ 
       ngDoCheck() {      
        // il s'agit des conditions pour affichage de la carte à init du component, pour éviter d'avoir des erreurs car les données n'ont pas été récupérer en backend 
        if (this.DataGDFStation.length > 0 && this.DataGDFPiezometry.length > 0 && this.DataGDFWatersheds.length >0 && !this.MapExecutee) {
            //this.WaterShedMap_Plotly(this.stationSelectionChange);
            this.WaterShedMap_Leaflet(this.stationSelectionChange);
          //bloc pour éviter d'avoir la fonction plotMap qui fonction en bloucle
          this.MapExecutee = true;
        }
      }

    /**
     * récupère les données des gdf des stations
     * contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
     * contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
     * contenus dans geometry: coordinates et type 
     * location du fichier origine :backend/data/stations.csv
     */
    initGDFStations() {
      this.jsonService.getGDFStations().then(data => {
        this.DataGDFStation = data;  
      });
    }

    /**
     * récupère les données des gdf des stations
     * contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
     * contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
     * contenus dans geometry: coordinates et type  
     * location du fichier origine :backend/data/stations.csv
     */
    initGDFWatersheds() {
      this.jsonService.getGDFWatersheds().then(data => {
        this.DataGDFWatersheds = data;  
        //console.log("watersheds", this.DataGDFWatersheds);
      });
    }

    /**
     * récupère les données des gdf des piezometre
     * contenus:identifiant_BSS(string),ancian ,x_wgs84(number), y_wgs84(number), Ancien_code_national_BSS(string), geometry(any)
     * format coordonées dans  X_wgs84 et Y_wgs84 : wgs84
     * contenus dans geometry: coordinates et type
     * location du fichier origine : backend/data/piezometry/stations.csv'
     */
    initGDFPiezometry(){
      this.jsonService.getGDFPiezometry().then(data => {
        this.DataGDFPiezometry = data;
        //console.log(this.DataGDFPiezometry);
      });
    }
  /**
   * 
   * @param stationID 
   * @returns 
   */
WaterShedMap_Leaflet(stationID:string){   
    let point1: any[] = [];
    let point2: any[] = [];
    let pointspoly: any[] = [];
    //si la carte existe, supprime (permet la maj pour la station selectionnée)
    if (this.WatershedMapLeaflet ) {
      this.WatershedMapLeaflet.remove();
    }
    // rechercher le center de base( c'est changer celon les points) et le Zoom de la carte 
    const PointData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (!PointData) return; 

    const center_lat = (PointData.min_lat + PointData.max_lat) / 2
    const center_lon = (PointData.min_lon + PointData.max_lon) / 2

    const zoom_lat: number = Math.abs(Math.abs(PointData.max_lat) - Math.abs(PointData.min_lat));
    const zoom_long: number = Math.abs(Math.abs(PointData.max_lon) - Math.abs(PointData.min_lon));
    let zoom_factor: number = Math.max(zoom_lat, zoom_long);
    
    if (zoom_factor < 0.002) {
        zoom_factor = 0.002;
    }
    const auto_zoom: number = -1.35 * Math.log(zoom_factor) + 8;

    // Mise en place de la carte Leaflet
    this.WatershedMapLeaflet = L.map('WatershedMapLeaflet', {
      center: [center_lat, center_lon],
      zoomControl: true,
      zoom: auto_zoom,
    layers: [this.WaterShedsMapLayers['BaseMap']]
  });

    // Ajouter des couches de base et des contrôles de zoom à la carte de la station
    L.control.layers(this.WaterShedsMapLayers).addTo(this.WatershedMapLeaflet);
    L.control.scale({ maxWidth: 100, imperial: false }).addTo(this.WatershedMapLeaflet);
    this.WatershedMapLeaflet.attributionControl.remove();

    // Créer le polygone autour de la station sélectionnée
    const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (stationData) {
      const selectedPolygonCoords = stationData.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
      pointspoly = selectedPolygonCoords
      L.polyline(selectedPolygonCoords, {
        color: '#3E88A6',
        weight: 2,
        fill: false,
        fillColor: 'red',
        fillOpacity: 0.5
      }).addTo(this.WatershedMapLeaflet);
      // Zoom sur le polygone de la station sélectionnée
      //this.WatershedMapLeaflet.fitBounds(selectedPolygonCoords);
    }
    // Créer un marqueur pour la station sélectionnée
    //cherche la station avec ID
    const selectedStation = this.DataGDFStation.find(data => data.index === stationID);
    if (selectedStation) {
      //remplie les coordonées de la station pour le bound
      point1 = [selectedStation.y_outlet, selectedStation.x_outlet];
      const stationMarker = L.circleMarker([selectedStation.y_outlet, selectedStation.x_outlet], { radius: 7, color: 'black',weight : 1, fill:true, fillColor: '#38BFFF',fillOpacity:0.4 })
        .bindPopup(`<b>Station hydrologique :</b><br>ID : ${selectedStation.index}<br>Nom: ${selectedStation.station_name}<br>(station piezo de référence: ${selectedStation.BSS_name})`);
      stationMarker.addTo(this.WatershedMapLeaflet);
      //chercher la station piezo avec ID BSS 
      const piezoSelectedStation = this.DataGDFPiezometry.find(data => data.identifiant_BSS === selectedStation.BSS_ID);
      if (piezoSelectedStation) {
        //remplie les coordonées de la station pour le bound
        point2 = [piezoSelectedStation.y_wgs84, piezoSelectedStation.x_wgs84];
        console.log(piezoSelectedStation);
        const piezoMarker = L.circleMarker([piezoSelectedStation.y_wgs84, piezoSelectedStation.x_wgs84], { radius: 7, color: 'black',weight : 1,fill:true, fillColor: '#D800A0',fillOpacity:0.4})
          .bindPopup(`<b>Station piezo de référence </b><br>ID : ${piezoSelectedStation.identifiant_BSS}<br>Nom : ${piezoSelectedStation.Nom}`);
        piezoMarker.addTo(this.WatershedMapLeaflet);
      }
    }
      // gerer le center celon les points piezo et station 
      let bounds = L.latLngBounds([point1, ...pointspoly]);
      if (point2) {
        bounds.extend(point2);
      }
      this.WatershedMapLeaflet.fitBounds(bounds);
    
  }

  /**
   * 
   * @param stationID 
   * @returns 
   */
  WaterShedMap_Plotly(stationID:string){
    const figData: any[] = [];
    // rechercher le center et le Zoom de la carte 
    const PointData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (!PointData) return; 

    const center_lat = (PointData.min_lat + PointData.max_lat) / 2
    const center_lon = (PointData.min_lon + PointData.max_lon) / 2

    const zoom_lat: number = Math.abs(Math.abs(PointData.max_lat) - Math.abs(PointData.min_lat));
    const zoom_long: number = Math.abs(Math.abs(PointData.max_lon) - Math.abs(PointData.min_lon));
    let zoom_factor: number = Math.max(zoom_lat, zoom_long);
    
    if (zoom_factor < 0.002) {
        zoom_factor = 0.002;
    }
    
    const auto_zoom: number = -1.35 * Math.log(zoom_factor) + 7.5;
    //met en place apparence de la carte
    const figLayout = {
      mapbox: {
        // les différents styles possibles sont 'white-bg' 'open-street-map', 'carto-positron', et 'carto-darkmatter'
        style: 'open-street-map',
        center: { "lat": center_lat, "lon": center_lon},
        zoom: auto_zoom,
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: true
    };

      // vérifie si la station sélectionner est bien dans les stations
      const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
      if (stationData){
        // Ajoute couche contour de la station selectionnée
        const selectedPolygonCoords = stationData.geometry.coordinates[0];
        figData.push({
        type: 'scattermapbox',
        lon: selectedPolygonCoords.map((coord: number[]) => coord[0]),
        lat: selectedPolygonCoords.map((coord: number[]) => coord[1]),
        mode: 'lines',
        line: { width: 2, color: 'blue' },
        hoverinfo: 'none',
        name: 'Selected Watershed'
        });
      }
    //récupère les informations de la stations
    const selectedStation = this.DataGDFStation.find(data => data.index === stationID);
    if (selectedStation) {
    // Ajout de la couche des points de la station sélectionnée
    figData.push({
        type: 'scattermapbox',
        text: [selectedStation.name], // Nom de la station sélectionnée
        lon: [selectedStation.x_outlet], // Longitude de la station sélectionnée
        lat: [selectedStation.y_outlet], // Latitude de la station sélectionnée
        mode: 'markers',
        marker: { size: 10, color: 'black' },
        name: 'Station',
      });

       const PiezoSelectedSation = this.DataGDFPiezometry.find(data => data.identifiant_BSS === selectedStation.BSS_ID)
        if (PiezoSelectedSation){
          figData.push({
            type : 'scattermapbox',
            text : [PiezoSelectedSation.identifiant_BSS],
            lon: [PiezoSelectedSation.x_wgs84],
            lat: [PiezoSelectedSation.y_wgs84],
            mode: 'markers',
            marker: { size: 10, color: '#D800A0' },
            name: 'Piezomètre',
          });
        }
    }
     // Création de la carte watershed ! identifiant de cette element est map :)
     Plotlydist.newPlot('WatershedMapPlotly', figData, figLayout);
  }
}