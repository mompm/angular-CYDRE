import { Component, Input, SimpleChanges, OnDestroy} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import * as L from 'leaflet';
import dataGDFPiezometry from 'src/app/model/dataGDFPiezometry';
import dataGDFWatersheds from 'src/app/model/dataGDFWatersheds';
import dataGDFStation from 'src/app/model/dataGDFStation';

/**
* Composant Angular pour afficher la carte watershed.
*/
@Component({
  selector: 'app-WatershedMap',
  templateUrl: './WatershedMap.component.html',
  styleUrls: ['./WatershedMap.component.scss']
})
  
export class WatershedMapComponent {
  private resizeListener: () => void;// Gestionnaire pour l'événement de redimensionnement
  @Input() stationSelectionChange!: string; // station selctionner (dans le parent)
  private WatershedMapLeaflet!: L.Map;  // Instance de la carte Leaflet
  MapExecutee = false; // Indicateur si la carte a été initialisée
  DataGDFWatersheds: dataGDFWatersheds[]  = []; // Données des bassins versants
  DataGDFPiezometry: dataGDFPiezometry [] = []; // Données des piézomètres
  DataGDFStation: dataGDFStation[]  =[]; // Données des stations

  /**
   * Différents types de fonds de carte disponibles dans Leaflet
   * Plusieurs types de fonds de carte (ex: satellite, noir et blanc, relief)
   */
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
  * Constructeur du composant.
  * Injecte les services nécessaires pour la gestion des données et JSON
  * @param dataService Service utilisé pour la récupération des données
  * @param jsonService Service pour la gestion des données JSON
  */
  constructor(private dataService: DataService,private jsonService: JsonService) {
    // Définition de l'écouteur pour ajuster la taille de la carte en fonction de la taille de l'écran.
    this.resizeListener = () => {
      this.WatershedMapLeaflet.invalidateSize();
    }; 
  }

  /**
   * Méthode appelée à l'initialisation du composant
   * Ajoute un écouteur pour les changements de taille de fenêtre
   * récupère les données dans le backend pour la creation de la carte
   */
  ngOnInit() {
    window.addEventListener('resize', this.resizeListener);
    this.initGDFWatersheds(); // Initialise les données des bassins versants
    this.initGDFPiezometry(); // Initialise les données des piézomètres
    this.initGDFStations(); // Initialise les données des stations
  }

  /**
   * Méthode appelée lors de la destruction du composant
   * Supprime l'écouteur d'événements pour éviter les fuites de mémoire
   */
  ngOnDestroy(){
    window.removeEventListener('resize',this.resizeListener);
  }

  /**
  * Méthode déclenchée lorsque les propriétés @Input changent.
  * Peut être utilisée pour réagir aux changements de la sélection de station
  * @param changes Les changements des propriétés @Input
  */
  ngOnChanges(changes: SimpleChanges) {
    // Vérifie si la sélection de station a changé
    if (changes['stationSelectionChange']) {
      this.MapExecutee = false; // Réinitialise l'indicateur de carte 
    }
  }

  /**
   * Méthode appelée à chaque cycle de détection de changements Angular
   * Vérifie si les données nécessaires sont disponibles avant d'afficher la carte
   */
  ngDoCheck() {      
    // Vérifie que toutes les données sont disponibles et que la carte n'a pas encore été initialisée 
    if (this.DataGDFStation.length > 0 && this.DataGDFPiezometry.length > 0 && this.DataGDFWatersheds.length >0 && !this.MapExecutee) {
      //this.WaterShedMap_Plotly(this.stationSelectionChange); // Affiche la carte avec Plotly
      this.WaterShedMap_Leaflet(this.stationSelectionChange); // Affiche la carte avec Leaflet 
      this.MapExecutee = true; // Marque la carte comme initialisée pour éviter les boucles infinies
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
 * Fonction pour créer et mettre à jour la carte du bassin versant avec Leaflet
 * @param stationID - L'identifiant de la station pour laquelle la carte doit être générée
 */
  WaterShedMap_Leaflet(stationID:string){   
    let point_hydro: any[] = []; // Tableau pour stocker les coordonnées de la station hydrologique
    let point_piezo: any[] = []; // Tableau pour stocker les coordonnées de la station piézométrique
    let pointspoly: any[] = []; // Tableau pour stocker les coordonnées du polygone du bassin versant

    // Si la carte existe déjà, la supprimer pour permettre la mise à jour
    if (this.WatershedMapLeaflet ) {
      this.WatershedMapLeaflet.remove();
    }
    
    // Recherche des données de la station basée sur l'identifiant fourni
    const PointData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (!PointData) return; // Si aucune donnée trouvée, sortir de la fonction

    // Calculer le centre de la carte en fonction des coordonnées min et max
    const center_lat = (PointData.min_lat + PointData.max_lat) / 2
    const center_lon = (PointData.min_lon + PointData.max_lon) / 2

    // Calculer le facteur de zoom en fonction des latitudes et longitudes
    const zoom_lat: number = Math.abs(Math.abs(PointData.max_lat) - Math.abs(PointData.min_lat));
    const zoom_long: number = Math.abs(Math.abs(PointData.max_lon) - Math.abs(PointData.min_lon));
    let zoom_factor: number = Math.max(zoom_lat, zoom_long);
    
    // S'assurer que le facteur de zoom n'est pas inférieur à une valeur minimale
    if (zoom_factor < 0.002) {
        zoom_factor = 0.002;
    }
    // Calculer le zoom 
    const auto_zoom: number = -1.35 * Math.log(zoom_factor) + 8;

    // Mise en place de la carte Leaflet
    this.WatershedMapLeaflet = L.map('WatershedMapLeaflet', {
      center: [center_lat, center_lon], // Centre de la carte
      zoomControl: true, // Activer le contrôle de zoom
      zoom: auto_zoom, // Définir le niveau de zoom
      layers: [this.WaterShedsMapLayers['BaseMap']] // Ajouter la couche de base
    });

    // Ajouter des contrôles de couches et d'échelle à la carte
    L.control.layers(this.WaterShedsMapLayers).addTo(this.WatershedMapLeaflet);
    L.control.scale({ maxWidth: 100, imperial: false }).addTo(this.WatershedMapLeaflet);
    this.WatershedMapLeaflet.attributionControl.remove(); // Supprimer le contrôle d'attribution par défaut

    // Créer le polygone autour de la station sélectionnée
    const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (stationData) {
      const selectedPolygonCoords = stationData.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
      pointspoly = selectedPolygonCoords // Stocker les coordonnées du polygone
      // Ajouter le polygone à la carte
      L.polyline(selectedPolygonCoords, {
        color: '#3E88A6', // Couleur de la ligne
        weight: 2, // Épaisseur de la ligne
        fill: false, // Pas de remplissage
        fillColor: 'red', // Couleur de remplissage
        fillOpacity: 0.5 // Opacité du remplissage
      }).addTo(this.WatershedMapLeaflet);
    }

    // Créer un marqueur pour la station hydrologique sélectionnée
    const selectedStation = this.DataGDFStation.find(data => data.index === stationID);
    if (selectedStation) {
      // Remplir les coordonnées de la station pour le bound
      point_hydro = [selectedStation.y_outlet, selectedStation.x_outlet];
      const stationMarker = L.circleMarker([selectedStation.y_outlet, selectedStation.x_outlet], { radius: 7, color: 'black',weight : 1, fill:true, fillColor: 'black',fillOpacity:1 })
        .bindPopup(`<b>Station hydrologique :</b><br>ID : ${selectedStation.index}<br>Nom: ${selectedStation.station_name}<br>`);
      stationMarker.addTo(this.WatershedMapLeaflet); // Ajouter le marqueur à la carte

      // Rechercher la station piézométrique associée avec l'ID BSS 
      const piezoSelectedStation = this.DataGDFPiezometry.find(data => data.identifiant_BSS === selectedStation.BSS_ID);
      if (piezoSelectedStation) {
        // Remplir les coordonnées de la station piézométrique pour le bound
        point_piezo = [piezoSelectedStation.y_wgs84, piezoSelectedStation.x_wgs84];
        const piezoMarker = L.circleMarker([piezoSelectedStation.y_wgs84, piezoSelectedStation.x_wgs84], { radius: 7, color: 'black',weight : 1,fill:true, fillColor: '#D800A0',fillOpacity:0.4})
          .bindPopup(`<b>Station piézométrique </b><br>ID : ${piezoSelectedStation.identifiant_BSS}<br>Nom : ${piezoSelectedStation.Nom}`);
        piezoMarker.addTo(this.WatershedMapLeaflet);  // Ajouter le marqueur à la carte
      }
    }

    // Gérer le centre de la carte en fonction des points des stations et du polygone
    let bounds = L.latLngBounds([point_hydro, ...pointspoly]); // Créer des limites à partir des points
    if (point_piezo) {
      bounds.extend(point_piezo); // Étendre les limites si une station piézométrique est présente
    }
    this.WatershedMapLeaflet.fitBounds(bounds); // Ajuster la vue de la carte pour afficher tous les points
  }

  /**
  * Fonction pour créer et mettre à jour la carte du bassin versant avec plotly
  * @param stationID - L'identifiant de la station pour laquelle la carte doit être générée
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