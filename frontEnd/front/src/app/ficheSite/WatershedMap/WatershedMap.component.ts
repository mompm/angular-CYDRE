import { Component, Input, SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import CorrespondancesBSSData from 'src/app/model/CorrespondanceBSSData';
import DFFData from 'src/app/model/DFFData';
import PiezoCoordData from 'src/app/model/PiezoCoordData';
import gdfData from 'src/app/model/gdfData';


@Component({
    selector: 'app-WatershedMap',
    templateUrl: './WatershedMap.component.html',
    styleUrls: ['./WatershedMap.component.scss']
  })
  export class WatershedMapComponent {
    @Input() stationSelectionChange!: string;
    private WatershedMapLeaflet!: L.Map;
    MapExecutee = false; 
    CorrespondanceBSSs: CorrespondancesBSSData[] = [];
    gdfData: gdfData[]  = [];
    DFFDatas : DFFData[] = [];
    PiezoCoordData: PiezoCoordData[] = [];



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

  constructor(private dataService: DataService) {}

    ngOnInit() {
      this.initCorrespondanceBSS();
      this.initgdfData();
      this.initDFF();
      this.initPiezoCoord();
      
    }

    ngOnChanges(changes: SimpleChanges) {
      // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
      // Vous pouvez y réagir en conséquence
      if (changes['stationSelectionChange']) {
        //console.log('La valeur de stationMap a changé :', changes['stationSelectionChange'].currentValue);
        this.MapExecutee = false;
        
      }
    }
       // fonction vérifiant en permanence si les conditions sont ok 
       ngDoCheck() {      
        // il s'agit des conditions pour affichage de la carte à init du component, pour éviter d'avoir des erreurs car les données n'ont pas été récupérer en backend 
        if (this.DFFDatas.length > 0 && this.PiezoCoordData.length > 0 && this.gdfData.length >0 && !this.MapExecutee) {
            //this.WaterShedMap_Plotly(this.stationSelectionChange);
            this.WaterShedMap_Leaflet(this.stationSelectionChange);
          //bloc pour éviter d'avoir la fonction plotMap qui fonction en bloucle
          this.MapExecutee = true;
        }
      }


    //récupère les données DFF (station mais avec les noms récuperer de Ades ) 
    //contenus:index(number), name(string), area(number), x_wgs84(number), y_wgs84 (number)
    //format coordonées dans  x_wgs84 et y_wgs84 : wgs84
    //location du fichier origine : backend/outpouts/data.pkl (attention les données sont transformormé dans le backend)
    initDFF(){
      this.dataService.getMesurementDFF().then(data => {
        this.DFFDatas = data;
      });
    }



    //récupère les données des correspondance stations et piezomètres 
    //contenus: NOM_BV (string), ID_HYDRO (string),CODE_BSS (string), TEMPS_RECESS(string)
    //location du fichier origine : backend/data/piezometry/correspondance_watershed_piezometers.csv
    initCorrespondanceBSS(){
      this.dataService.getMesurementCorrespondanceBSS().then(correspondance => {
        this.CorrespondanceBSSs = correspondance;
      });
    }
    //récupère les données des gdf (GeoDataFrame des stations)
    //contenus: index(string), name(string), geometry_area(number), hydro_area(number),K1 (any), geometry(any)
    //contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
    //contenus dans geometry: coordinates et type  
    //location du fichier origine :backend/outpouts/data.pkl puis transformé en geodataframe avec la fonction create_watershed_geodataframe en backend
    initgdfData() {
      this.dataService.getDatagdf().then(data => {
        this.gdfData = data;  
      });
    }

    //récupère les données des coordonées des piezometres
    //contenus:identifiant_BSS(string), x_wgs84(number), y_wgs84(number)
    //format coordonées dans  X_wgs84 et Y_wgs84 : wgs84
    //location du fichier origine : backend/data/piezometry/stations.csv'
    initPiezoCoord(){
      this.dataService.getMesurementPiezoCoord().then(data => {
        this.PiezoCoordData = data;
      });
    }
  
WaterShedMap_Leaflet(stationID:string){
    //si la carte existe, supprime (permet la maj pour la station selectionnée)
    if (this.WatershedMapLeaflet ) {
      this.WatershedMapLeaflet.remove();
    }
    // rechercher le center et le Zoom de la carte 
    const PointData = this.DFFDatas.find(data => data.index === stationID);
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
    const stationData = this.gdfData.find(data => data.index === stationID);
    if (stationData) {
      const selectedPolygonCoords = stationData.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
      L.polyline(selectedPolygonCoords, {
        color: 'blue',
        weight: 4,
        fill: false,
        fillColor: 'red',
        fillOpacity: 0.5
      }).addTo(this.WatershedMapLeaflet);
      // Zoom sur le polygone de la station sélectionnée
      //this.WatershedMapLeaflet.fitBounds(selectedPolygonCoords);
    }
    // Créer un marqueur pour la station sélectionnée
    const selectedStation = this.DFFDatas.find(data => data.index === stationID);
    if (selectedStation) {
      const stationMarker = L.circleMarker([selectedStation.y_wgs84, selectedStation.x_wgs84], { radius: 4, color: 'black',fill:true, fillColor: 'black',fillOpacity:1 })
        .bindPopup(`<b>${selectedStation.name}</b><br>${selectedStation.y_wgs84}<br>${selectedStation.x_wgs84}`);
      stationMarker.addTo(this.WatershedMapLeaflet);
    }

    // Trouver le piezomètre correspondant à la station sélectionnée
    const selectedCorrespondance = this.CorrespondanceBSSs.find(correspondance => correspondance.ID_HYDRO === stationID);
    if (selectedCorrespondance) {
      const piezoSelectedStation = this.PiezoCoordData.find(data => data.identifiant_BSS === selectedCorrespondance.CODE_BSS);
      if (piezoSelectedStation) {
        const piezoMarker = L.circleMarker([piezoSelectedStation.y_wgs84, piezoSelectedStation.x_wgs84], { radius: 4, color: '#D800A0',fill:true, fillColor: '#D800A0',fillOpacity:1})
          .bindPopup(`<b>${piezoSelectedStation.identifiant_BSS}</b><br>${piezoSelectedStation.y_wgs84}<br>${piezoSelectedStation.x_wgs84}`);
        piezoMarker.addTo(this.WatershedMapLeaflet);
      }
    } 
  }

  
  WaterShedMap_Plotly(stationID:string){
    const figData: any[] = [];
    // rechercher le center et le Zoom de la carte 
    const PointData = this.DFFDatas.find(data => data.index === stationID);
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
      const stationData = this.gdfData.find(data => data.index === stationID);
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
    const selectedStation = this.DFFDatas.find(data => data.index === stationID);
    if (selectedStation) {
    // Ajout de la couche des points de la station sélectionnée
    figData.push({
        type: 'scattermapbox',
        text: [selectedStation.name], // Nom de la station sélectionnée
        lon: [selectedStation.x_wgs84], // Longitude de la station sélectionnée
        lat: [selectedStation.y_wgs84], // Latitude de la station sélectionnée
        mode: 'markers',
        marker: { size: 10, color: 'black' },
        name: 'Station',
      });
    }
    const selectedCorrespondance = this.CorrespondanceBSSs.find(CorrespondanceBSS => CorrespondanceBSS.ID_HYDRO === stationID);
    if (selectedCorrespondance){
       const PiezoSelectedSation = this.PiezoCoordData.find(data => data.identifiant_BSS === selectedCorrespondance.CODE_BSS)
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