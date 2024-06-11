import { Component, Input, Output , EventEmitter , SimpleChanges, OnDestroy} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import dataGDFPiezometry from 'src/app/model/dataGDFPiezometry';
import dataGDFWatersheds from 'src/app/model/dataGDFWatersheds';
import dataGDFStation from 'src/app/model/dataGDFStation';

/**
 * Composant Angular pour afficher la carte Regional.
 */
@Component({
    selector: 'app-RegionalMap',
    templateUrl: './RegionalMap.component.html',
    styleUrls: ['./RegionalMap.component.scss']
  })

  export class RegionalMapComponent {
    private resizeListener: () => void;

    @Input() stationSelectionChange!: string; // Prend en entrée la sélection de la station
    @Output() markerClick: EventEmitter<string> = new EventEmitter<string>(); // Émetteur d'événement pour le clic sur un marqueur
    private RegionalMapLeaflet!: L.Map; // Instance de la carte Leaflet
    MapExecutee = false; // Indicateur si la carte a été initialisée
    DataGDFWatersheds: dataGDFWatersheds[] = []; // Données des bassins versants
    DataGDFPiezometry: dataGDFPiezometry[] = []; // Données des piézomètres
    DataGDFStation: dataGDFStation[] = []; // Données des stations
  
  // Différents types de fonds de carte avec Leaflet
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

    /**
   * Constructeur de la classe, injecte les services nécessaires
   * @param dataService Service pour les données
   * @param jsonService Service pour les opérations JSON
   */
    constructor(private dataService: DataService,private jsonService: JsonService) {
      this.resizeListener = () => {
        const hydrographWidth = 0.50 * window.innerWidth;
        Plotlydist.relayout('RegionalMapPlotly', { width: hydrographWidth });
      };
    }

    /**
     * Méthode appelée à l'initialisation du composant
     */
    ngOnInit() {
      this.initGDFWatersheds(); // Initialise les données des bassins versants
      this.initGDFPiezometry(); // Initialise les données des piézomètres
      this.initGDFStations(); // Initialise les données des stations
    }
    
    ngOnDestroy(){
      window.removeEventListener('resize',this.resizeListener);
    }
    /**
     * Méthode appelée lorsque les valeurs des propriétés @Input changent
     * @param changes Les changements des propriétés @Input
     */
    ngOnChanges(changes: SimpleChanges) {
      // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
      // Vous pouvez y réagir en conséquence
      if (changes['stationSelectionChange']) {
        //console.log('La valeur de stationMap a changé :', changes['stationSelectionChange'].currentValue);
        this.MapExecutee = false    
      }
    }


      /**
       * Méthode appelée à chaque cycle de détection des changements
       */
      ngDoCheck() {      
      // il s'agit des conditions pour affichage de la carte à init du component, pour éviter d'avoir des erreurs car les données n'ont pas été récupérer en backend 
      if (this.DataGDFStation.length > 0 && this.DataGDFPiezometry.length > 0 && this.DataGDFWatersheds.length >0 && !this.MapExecutee) {
        this.RegionalMap_Plotly(this.stationSelectionChange);
        //this.RegionalMap_Leaflet(this.stationSelectionChange);
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
        console.log(this.DataGDFStation);
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
      });
    }

    /**
     * affiche la carte régional avec Leaflet (contour station selectionée rouge, contour des autre stations, points de la station, points piezo )
     * @param stationID 
     */
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
      this.DataGDFWatersheds.forEach((data, index) => {
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
      const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
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
      for (let i = 0; i < this.DataGDFStation.length; i++) {
        // Création du marqueur
        const markerstations = L.circleMarker([this.DataGDFStation[i].y_outlet, this.DataGDFStation[i].x_outlet], {radius: 1.2,color: 'black'})
            .bindPopup(`<b>${this.DataGDFStation[i].name}</b><br>${this.DataGDFStation[i].y_outlet}<br>${this.DataGDFStation[i].x_outlet}`);
        // Ajout du marqueur 
        markerstations.addTo(this.RegionalMapLeaflet);
      }
      

      //création des point piezo  
      //boucle parcourant tous les points des piezometre  
      for (let i = 0; i < this.DataGDFPiezometry.length; i++){
        // Création du marqueur
        const markerpiezo = L.circleMarker([this.DataGDFPiezometry[i].y_wgs84,this.DataGDFPiezometry[i].x_wgs84],{radius:1 , color: '#D800A0'})
          .bindPopup(`<b>${this.DataGDFPiezometry[i].identifiant_BSS}</b><br>${this.DataGDFPiezometry[i].y_wgs84}<br>${this.DataGDFPiezometry[i].x_wgs84}`)
        // Ajout du marqueur 
        markerpiezo.addTo(this.RegionalMapLeaflet);
      }
    }


    /**
     * affiche la carte régional avec plotly (contour station selectionée rouge, contour des autre stations, points de la station, points piezo )
     * @param stationID 
     * @returns 
     */
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
    const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (!stationData) return; // Sinon sort de la fonction 

    // Ajoute couches tous les contours de stations 
    const watershedPolygons = this.DataGDFWatersheds.map((data, index) => {
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
    for (let i = 0; i < this.DataGDFStation.length; i++) {
        x_wgs84_station.push(this.DataGDFStation[i].x_outlet);
        y_wgs84_station.push(this.DataGDFStation[i].y_outlet);
        text_station.push(`${this.DataGDFStation[i].index} - ${this.DataGDFStation[i].station_name}`);
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
    for (let i = 0; i < this.DataGDFPiezometry.length; i++) {
      x_wgs84_piezo.push(this.DataGDFPiezometry[i].x_wgs84);
      y_wgs84_piezo.push(this.DataGDFPiezometry[i].y_wgs84);
      text_piezo.push(`${this.DataGDFPiezometry[i].identifiant_BSS} - ${this.DataGDFPiezometry[i].Nom}`);
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
    
    
  }

   

  
}