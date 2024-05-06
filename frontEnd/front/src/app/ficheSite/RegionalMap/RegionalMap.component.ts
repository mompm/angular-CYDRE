import { Component, Input, SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import CorrespondancesBSSData from 'src/app/model/CorrespondanceBSSData';
import DFFData from 'src/app/model/DFFData';
import PiezoCoordData from 'src/app/model/PiezoCoordData';
import gdfData from 'src/app/model/gdfData';


@Component({
    selector: 'app-RegionalMap',
    templateUrl: './RegionalMap.component.html',
    styleUrls: ['./RegionalMap.component.scss']
  })
  export class RegionalMapComponent {
    @Input() stationSelectionChange!: string;
    private RegionalMapLeaflet!: L.Map;
    MapExecutee = false; 
    CorrespondanceBSSs: CorrespondancesBSSData[] = [];
    gdfData: gdfData[]  = [];
    DFFDatas : DFFData[] = [];
    PiezoCoordData: PiezoCoordData[] = [];



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
      this.initgdfData();
      this.initDFF();
      this.initPiezoCoord();
      
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
        if (this.DFFDatas.length > 0 && this.PiezoCoordData.length > 0 && this.gdfData.length >0 && !this.MapExecutee) {
          //this.RegionalMap_Plotly(this.stationSelectionChange);
          this.RegionalMap_Leaflet(this.stationSelectionChange);
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
      this.gdfData.forEach((data, index) => {
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
      const stationData = this.gdfData.find(data => data.index === stationID);
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
      for (let i = 0; i < this.DFFDatas.length; i++) {
        // Création du marqueur
        const markerstations = L.circleMarker([this.DFFDatas[i].y_wgs84, this.DFFDatas[i].x_wgs84], {radius: 1.2,color: 'black'})
            .bindPopup(`<b>${this.DFFDatas[i].name}</b><br>${this.DFFDatas[i].y_wgs84}<br>${this.DFFDatas[i].x_wgs84}`);
        // Ajout du marqueur 
        markerstations.addTo(this.RegionalMapLeaflet);
      }

      //création des point piezo  
      //boucle parcourant tous les points des piezometre  
      for (let i = 0; i < this.PiezoCoordData.length; i++){
        // Création du marqueur
        const markerpiezo = L.circleMarker([this.PiezoCoordData[i].y_wgs84,this.PiezoCoordData[i].x_wgs84],{radius:1 , color: '#D800A0'})
          .bindPopup(`<b>${this.PiezoCoordData[i].identifiant_BSS}</b><br>${this.PiezoCoordData[i].y_wgs84}<br>${this.PiezoCoordData[i].x_wgs84}`)
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
    const stationData = this.gdfData.find(data => data.index === stationID);
    if (!stationData) return; // Sinon sort de la fonction 

    // Ajoute couches tous les contours de stations 
    const watershedPolygons = this.gdfData.map((data, index) => {
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
      line: { width: 0.0001 },
      fill: 'toself',
      fillcolor: 'rgba(255, 0, 0, 0.5)',
      hoverinfo: 'none',
      name: 'Selected Watershed'
    });

    //récupère les informations des points stations
    const nom_station: any[] = [];
    const x_wgs84_station: any[] = [];
    const y_wgs84_station: any[] = [];
    for (let i = 0; i < this.DFFDatas.length; i++) {
        nom_station.push(this.DFFDatas[i].name);
        x_wgs84_station.push(this.DFFDatas[i].x_wgs84);
        y_wgs84_station.push(this.DFFDatas[i].y_wgs84);
    }
    //Ajoute couches des points stations
    figData.push({
      type: 'scattermapbox',
      text: nom_station,
      lon: x_wgs84_station,
      lat: y_wgs84_station,
      mode: 'markers',
      marker: { size: 5, color: 'black' },
      name: '',
    });

    //récupère les information points piezo
    const bss_piezo: any[] = [];
    const x_wgs84_piezo: any[] = [];
    const y_wgs84_piezo: any[] = [];
    for (let i = 0; i < this.PiezoCoordData.length; i++) {
      bss_piezo.push(this.PiezoCoordData[i].identifiant_BSS);
      x_wgs84_piezo.push(this.PiezoCoordData[i].x_wgs84);
      y_wgs84_piezo.push(this.PiezoCoordData[i].y_wgs84);
    }
    //Ajoute la couche des points piezo
    figData.push({
      type: 'scattermapbox',
      text : bss_piezo,
      lon: x_wgs84_piezo,
      lat: y_wgs84_piezo,
      mode: 'markers',
      marker: { size: 5, color: '#D800A0' },
      name: '',
    });

    // Création de la carte regional ! identifiant de cette element est map :)
    Plotlydist.newPlot('RegionalMapPlotly', figData, figLayout);
  }

   

  
}