import { Component, Input, Output , EventEmitter , SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import CorrespondancesBSSData from 'src/app/model/CorrespondanceBSSData';
import GDFPiezometryData  from 'src/app/model/GDFPiezometryData ';
import GDFWatershedsData from 'src/app/model/GDFWatershedsData';
import GDFStationData from 'src/app/model/GDFStationData';


@Component({
    selector: 'app-RegionalMap',
    templateUrl: './RegionalMap.component.html',
    styleUrls: ['./RegionalMap.component.scss']
  })
  export class RegionalMapComponent {
    @Input() stationSelectionChange!: string;
    @Output() markerClick: EventEmitter<string> = new EventEmitter<string>();
    private RegionalMapLeaflet!: L.Map;
    MapExecutee = false; 
    CorrespondanceBSSs: CorrespondancesBSSData[] = [];
    GDFWatershedsDatas: GDFWatershedsData[]  = [];
    GDFPiezometryDatas : GDFPiezometryData [] = [];
    GDFStationDatas: GDFStationData[]  =[];



  //permet d'avoir différents type de map avec Leaflet
  //basemaps :
  //classic (openstreetmap ou positron)
  //satellite
  //noir et blanc
  //relief
  RegionalmapsLayers = {
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
      this.initGDFWatersheds();
      this.initGDFPiezometry();
      this.initGDFStations();
      
    }

    ngOnChanges(changes: SimpleChanges) {
      // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
      // Vous pouvez y réagir en conséquence
      if (changes['stationSelectionChange']) {
        //console.log('La valeur de stationMap a changé :', changes['stationSelectionChange'].currentValue);
        this.MapExecutee = false
        
      }
    }
       // fonction vérifiant en permanence si les conditions sont ok 
       ngDoCheck() {      
        // il s'agit des conditions pour affichage de la carte à init du component, pour éviter d'avoir des erreurs car les données n'ont pas été récupérer en backend 
        if (this.GDFStationDatas.length > 0 && this.GDFPiezometryDatas.length > 0 && this.GDFWatershedsDatas.length >0 && !this.MapExecutee) {
          this.RegionalMap_Plotly(this.stationSelectionChange);
          //this.RegionalMap_Leaflet(this.stationSelectionChange);
          //bloc pour éviter d'avoir la fonction plotMap qui fonction en bloucle
          this.MapExecutee = true;
        }
      }

    //récupère les données des gdf des stations
    //contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
    //contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
    //contenus dans geometry: coordinates et type  
    //location du fichier origine :backend/data/stations.csv
    initGDFStations() {
      this.dataService.getMesurementGDFStation().then(data => {
        this.GDFStationDatas = data;  
        console.log(this.GDFStationDatas);
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

        //récupère les données des gdf des stations
    //contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
    //contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
    //contenus dans geometry: coordinates et type  
    //location du fichier origine :backend/data/stations.csv
    initGDFWatersheds() {
      this.dataService.getMesurementGDFWatersheds().then(data => {
        this.GDFWatershedsDatas = data;  
      });
    }

    //récupère les données des gdf des piezometre
    //contenus:identifiant_BSS(string),ancian ,x_wgs84(number), y_wgs84(number), Ancien_code_national_BSS(string), geometry(any)
    //format coordonées dans  X_wgs84 et Y_wgs84 : wgs84
     //contenus dans geometry: coordinates et type  
    //location du fichier origine : backend/data/piezometry/stations.csv'
    initGDFPiezometry(){
      this.dataService.getMesurementGDFPiezometre().then(data => {
        this.GDFPiezometryDatas = data;
      });
    }

    // affiche la carte régional avec Leaflet (contour station selectionée rouge, contour des autre stations, points de la station, points piezo )
    RegionalMap_Leaflet(stationID: string) {
      //si la carte existe, supprime (permet la maj pour la station selectionnée)
      if (this.RegionalMapLeaflet) {
        this.RegionalMapLeaflet.remove();
      }
      //mise en place layout
      this.RegionalMapLeaflet = L.map('RegionalMapLeaflet', {
        center: [48.2141667, -2.9424167],
        zoomControl: true,
        zoom: 8,
        layers: [this.RegionalmapsLayers['BaseMap']]
      });
      

      L.control.layers(this.RegionalmapsLayers).addTo(this.RegionalMapLeaflet);
      L.control.scale({ maxWidth: 100, imperial: false }).addTo(this.RegionalMapLeaflet);
      this.RegionalMapLeaflet.attributionControl.remove(); 

      //création des polygones de toutes les stations
      //boucle pour parcourir toutes les stations
      this.GDFWatershedsDatas.forEach((data, index) => {
        //récupère les coordonées du polygones
        const polygonCoords= data.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
        //ajout du polygone
        L.polyline(polygonCoords, {
          color: '#3E88A6',
          weight: 0.8,
          fill : true,
          fillColor :'rgba(0, 0, 0, 0.1)',
          fillOpacity: 0.7,
          opacity: 1
        }).addTo(this.RegionalMapLeaflet);
      });


      // Création du polygone autour de la station sélectionnée
      //vérifie que la station existe dans GDF
      const stationData = this.GDFWatershedsDatas.find(data => data.index === stationID);
      if (!stationData) return; 
      //récupère les coordonées du polygones
      const selectedPolygonCoords = stationData.geometry.coordinates[0];
      const latlngs= selectedPolygonCoords.map((coord: any[]) => [coord[1], coord[0]]);
      //ajout du polygone
      L.polyline(latlngs, {
        color: '#3E88A6' ,
        weight: 1,
        fill : true,
        fillColor: 'red',
        fillOpacity :0.5
      }).addTo(this.RegionalMapLeaflet);

      //création des points station
      //boucle parcourant tous les points des stations
      for (let i = 0; i < this.GDFStationDatas.length; i++) {
        // Création du marqueur
        const markerstations = L.circleMarker([this.GDFStationDatas[i].y_outlet, this.GDFStationDatas[i].x_outlet], {radius: 1.2,color: 'black'})
            .bindPopup(`<b>${this.GDFStationDatas[i].name}</b><br>${this.GDFStationDatas[i].y_outlet}<br>${this.GDFStationDatas[i].x_outlet}`);
        // Ajout du marqueur 
        markerstations.addTo(this.RegionalMapLeaflet);
      }
      

      //création des point piezo  
      //boucle parcourant tous les points des piezometre  
      for (let i = 0; i < this.GDFPiezometryDatas.length; i++){
        // Création du marqueur
        const markerpiezo = L.circleMarker([this.GDFPiezometryDatas[i].y_wgs84,this.GDFPiezometryDatas[i].x_wgs84],{radius:1 , color: '#D800A0'})
          .bindPopup(`<b>${this.GDFPiezometryDatas[i].identifiant_BSS}</b><br>${this.GDFPiezometryDatas[i].y_wgs84}<br>${this.GDFPiezometryDatas[i].x_wgs84}`)
        // Ajout du marqueur 
        markerpiezo.addTo(this.RegionalMapLeaflet);
      }
    }
   // affiche la carte régional avec plotly (contour station selectionée rouge, contour des autre stations, points de la station, points piezo )
   RegionalMap_Plotly(stationID: string) {
      
    const figData: any[] = [];
    //met en place apparence de la carte
    const figLayout = {
      mapbox: {
        // les différents styles possibles sont 'white-bg' 'open-street-map', 'carto-positron', et 'carto-darkmatter'
        style: 'open-street-map',
        center: { lat: 48.2141667, lon: -2.9424167 },
        zoom: 6.5,
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: false
    };
    // vérifie si la station sélectionner est bien dans les stations
    const stationData = this.GDFWatershedsDatas.find(data => data.index === stationID);
    if (!stationData) return; // Sinon sort de la fonction 

    // Ajoute couches tous les contours de stations 
    const watershedPolygons = this.GDFWatershedsDatas.map((data, index) => {
      const polygonCoords = data.geometry.coordinates[0];
      return {
        type: 'scattermapbox',
        lon: polygonCoords.map((coord: number[]) => coord[0]),
        lat: polygonCoords.map((coord: number[]) => coord[1]),
        mode: 'lines',
        line: { width: 0.8, color: '#3E88A6' },
        fill: 'toself',
        fillcolor: 'rgba(0, 0, 0, 0.1)',
        hoverinfo: 'none',
        name: `Watershed Boundaries ${index + 1}`
      };
    });
    figData.push(...watershedPolygons);
  
    // Ajoute couche contour de la station selectionnée
    const selectedPolygonCoords = stationData.geometry.coordinates[0];
    figData.push({
      type: 'scattermapbox',
      lon: selectedPolygonCoords.map((coord: number[]) => coord[0]),
      lat: selectedPolygonCoords.map((coord: number[]) => coord[1]),
      mode: 'lines',
      line: { width: 0.0001 , color: '#3E88A6'},
      fill: 'toself',
      fillcolor: 'rgba(255, 0, 0, 0.5)',
      hoverinfo: 'none',
      name: 'Selected Watershed'
    });

    //récupère les informations des points stations
    const x_wgs84_station: any[] = [];
    const y_wgs84_station: any[] = [];
    const text_station: any[] = []; 
    for (let i = 0; i < this.GDFStationDatas.length; i++) {
        x_wgs84_station.push(this.GDFStationDatas[i].x_outlet);
        y_wgs84_station.push(this.GDFStationDatas[i].y_outlet);
        text_station.push(`${this.GDFStationDatas[i].index} - ${this.GDFStationDatas[i].station_name}`);
    }
    //Ajoute couches des points stations
    figData.push({
      type: 'scattermapbox',
      lon: x_wgs84_station,
      lat: y_wgs84_station,
      mode: 'markers',
      marker: { size: 5, color: '#3E88A6' },
      hoverinfo:'text',
      hovertext: text_station,
      name: '',
    });

    //récupère les information points piezo
    const x_wgs84_piezo: any[] = [];
    const y_wgs84_piezo: any[] = [];
    const text_piezo: any[] = []; 
    for (let i = 0; i < this.GDFPiezometryDatas.length; i++) {
      x_wgs84_piezo.push(this.GDFPiezometryDatas[i].x_wgs84);
      y_wgs84_piezo.push(this.GDFPiezometryDatas[i].y_wgs84);
      text_piezo.push(`${this.GDFPiezometryDatas[i].identifiant_BSS} - ${this.GDFPiezometryDatas[i].Nom}`);
    }
    //Ajoute la couche des points piezo
    figData.push({
      type: 'scattermapbox',
      lon: x_wgs84_piezo,
      lat: y_wgs84_piezo,
      mode: 'markers',
      marker: { size: 5, color: 'purple' },
      hoverinfo:'text',
      hovertext: text_piezo,
      name: '',
    });

    // Création de la carte regional ! identifiant de cette element est map :)
    Plotlydist.newPlot('RegionalMapPlotly', figData, figLayout);

    const plotlyElement = document.getElementById('RegionalMapPlotly');
    if (plotlyElement) {
      (plotlyElement as any).on('plotly_click', (data: any) => {
        const point = data.points[0];
        const text = point.hovertext;
        const id = text.split(' - ')[0]; // Sépare la chaîne en utilisant le caractère "-"
        this.markerClick.emit(id);
        console.log(`ID du marker : ${id}`);
      });
    }
    
    window.addEventListener('resize', () => {
      const hydrographWidth = 0.50 * window.innerWidth;
      Plotlydist.relayout('RegionalMapPlotly', { width: hydrographWidth });
    });
  }

   

  
}