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
  private resizeListener: () => void; // Gestionnaire pour l'événement de redimensionnement
  @Input() stationSelectionChange!: string; // station selctionner (dans le parent)
  @Output() markerClick: EventEmitter<string> = new EventEmitter<string>(); // / Émet au parent un événement lors du clic sur un marqueur
  //private RegionalMapLeaflet!: L.Map; // Instance de la carte Leaflet (pas activé car on utilise pas leaflet)
  MapExecutee = false; // Indicateur si la carte a été initialisée
  DataGDFWatersheds: dataGDFWatersheds[] = []; // Données des bassins versants
  DataGDFPiezometry: dataGDFPiezometry[] = []; // Données des piézomètres
  DataGDFStation: dataGDFStation[] = []; // Données des stations

   /**
   * Différents types de fonds de carte disponibles dans Leaflet
   * Plusieurs types de fonds de carte (ex: satellite, noir et blanc, relief)
   */
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
  * Constructeur du composant.
  * Injecte les services nécessaires pour la gestion des données et JSON
  * @param dataService Service utilisé pour la récupération des données
  * @param jsonService Service pour la gestion des données JSON
  */
  constructor(private dataService: DataService,private jsonService: JsonService) {
    // Définition de l'écouteur pour ajuster la taille de la carte en fonction de la taille de l'écran.
    this.resizeListener = () => {
      const hydrographWidth = 0.50 * window.innerWidth;
      Plotlydist.relayout('RegionalMapPlotly', { width: hydrographWidth });
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
      this.MapExecutee = false // Réinitialise l'indicateur de carte 
    }
  }

  /**
   * Méthode appelée à chaque cycle de détection de changements Angular
   * Vérifie si les données nécessaires sont disponibles avant d'afficher la carte
   */
  ngDoCheck() {      
     // Vérifie que toutes les données sont disponibles et que la carte n'a pas encore été initialisée 
    if (this.DataGDFStation.length > 0 && this.DataGDFPiezometry.length > 0 && this.DataGDFWatersheds.length >0 && !this.MapExecutee) {
      this.RegionalMap_Plotly(this.stationSelectionChange);// Affiche la carte avec Plotly
      //this.RegionalMap_Leaflet(this.stationSelectionChange); // Affiche la carte avec Leaflet
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
   * Affiche la carte régionale avec Plotly.
   * Contourne les stations sélectionnées en rouge et affiche les autres en noir.
   * @param stationID L'identifiant de la station sélectionnée
   */
  RegionalMap_Plotly(stationID: string) {
    const figData: any[] = []; // Stocke les données de la carte pour Plotly
    const figLayout = {
      mapbox: {
        style: 'open-street-map', // Utilise le style OpenStreetMap pour l'affichage
        center: { lat: 48.2141667, lon: -2.9424167 }, // Centre initial de la carte
        zoom: 6.8, // Niveau de zoom initial
      },
      paper_bgcolor: 'rgba(0,0,0,0)', // Fond transparent pour la carte
      margin: { l: 0, r: 0, t: 0, b: 0 }, // Marges de la carte
      showlegend: false // Masque la légende de la carte
    };

    // Recherche les données du bassin versant correspondant à la station sélectionnée
    const stationData = this.DataGDFWatersheds.find(data => data.index === stationID);
    if (!stationData) return; // Si la station n'existe pas, la fonction s'arrête

    // Ajoute les contours de tous les bassins versants sur la carte
    const watershedPolygons = this.DataGDFWatersheds.map((data, index) => {
      const polygonCoords = data.geometry.coordinates[0];
      return {
        type: 'scattermapbox', // Type de trace pour un polygone sur la carte
        lon: polygonCoords.map((coord: number[]) => coord[0]), // Coordonnées de longitude
        lat: polygonCoords.map((coord: number[]) => coord[1]), // Coordonnées de latitude
        mode: 'lines', // Mode d'affichage des lignes
        line: { width: 0.8, color: '#3E88A6' }, // Style de ligne du polygone
        fill: 'toself',// Remplit le polygone
        fillcolor: 'rgba(0, 0, 0, 0.1)', // Couleur de remplissage semi-transparente
        hoverinfo: 'none', // Pas d'informations au survol
        name: `Watershed Boundaries ${index + 1}` // Nom de la série de données
      };
    });
    figData.push(...watershedPolygons); // Ajoute les polygones à la figure Plotly

    // Récupère les coordonnées du polygone sélectionné pour la station
    const selectedPolygonCoords = stationData.geometry.coordinates[0];

    // Ajoute un polygone pour le bassin versant sélectionné 
    figData.push({
      type: 'scattermapbox', // Type de trace pour un polygone sur la carte
      lon: selectedPolygonCoords.map((coord: number[]) => coord[0]),
      lat: selectedPolygonCoords.map((coord: number[]) => coord[1]),
      mode: 'lines', // Mode d'affichage des lignes
      line: { width: 0.0001, color: '#3E88A6' }, // Style de ligne du polygone
      fill: 'toself', // Remplit le polygone
      fillcolor: 'rgba(255, 0, 0, 0.5)', // Couleur de remplissage semi-transparente
      hoverinfo: 'none', // Pas d'informations au survol
      name: 'Selected Watershed' // Nom de la série de données
    });

    // Initialisation des tableaux pour stocker les coordonnées des stations hydrologique
    const x_wgs84_station: any[] = []; // Coordonnées de longitude des stations
    const y_wgs84_station: any[] = []; // Coordonnées de latitude des stations
    const text_station: any[] = []; // Texte à afficher lors du survol des marqueurs

    // Boucle pour remplir les tableaux avec les données des stations
    for (let i = 0; i < this.DataGDFStation.length; i++) {
      x_wgs84_station.push(this.DataGDFStation[i].x_outlet);
      y_wgs84_station.push(this.DataGDFStation[i].y_outlet);
      text_station.push(`${this.DataGDFStation[i].index} - ${this.DataGDFStation[i].station_name}`);
    }

    // Ajoute des marqueurs pour les stations sur la carte
    figData.push({
      type: 'scattermapbox', // Type de trace pour les marqueurs
      lon: x_wgs84_station, // Coordonnées de longitude des marqueurs
      lat: y_wgs84_station, // Coordonnées de latitude des marqueurs
      mode: 'markers', // Mode d'affichage des marqueurs
      marker: { size: 6, color: 'black' }, // Style des marqueurs
      hoverinfo: 'text', // Affiche les informations au survol
      hovertext: text_station, // Texte à afficher au survol des marqueurs
      name: '', // Nom de la série de données (vide ici)
    });

    // Détermine la largeur du graphique en fonction de la taille de la fenêtre
    const hydrographWidth = 0.50 * window.innerWidth;
    // Génère la carte avec Plotly
    Plotlydist.newPlot('RegionalMapPlotly', figData, figLayout, { responsive: true }).then(() => {
      // Ajuste la largeur du graphique après son chargement
      Plotlydist.relayout('RegionalMapPlotly', { width: hydrographWidth });
      // Récupère l'élément DOM du graphique Plotly pour ajouter un événement de clic
      const plotlyElement = document.getElementById('RegionalMapPlotly');
        if (plotlyElement) {
          // Ajoute un écouteur d'événements pour le clic sur les marqueurs
          (plotlyElement as any).on('plotly_click', (data: any) => {
            const point = data.points[0]; // Récupère le premier point cliqué
            const text = point.hovertext; // Récupère le texte d'affichage du point
            const id = text.split(' - ')[0]; // Extrait l'ID de la station à partir du texte
            this.markerClick.emit(id); // Émet un événement avec l'ID de la station
            //console.log(`ID du marker : ${id}`); // Optionnel : affichage de l'ID dans la console
          });
        }
    }).catch(error => {
      // Gestion des erreurs lors du chargement de la carte
      console.error("Error loading Plotly map:", error);
    });
  }

  /**
   * Affiche la carte régionale avec Leaflet.
   * Contourne les stations sélectionnées en rouge et affiche les autres en noir.
   * @param stationID L'identifiant de la station sélectionnée
   */

  /*
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
      markerstations.addTo(this.RegionalMapLeaflet);// Ajout du marqueur 
    }
        
    //création des point piezo  
    //boucle parcourant tous les points des piezometre  
    for (let i = 0; i < this.DataGDFPiezometry.length; i++){
      // Création du marqueur
      const markerpiezo = L.circleMarker([this.DataGDFPiezometry[i].y_wgs84,this.DataGDFPiezometry[i].x_wgs84],{radius:1 , color: '#D800A0'})
        .bindPopup(`<b>${this.DataGDFPiezometry[i].identifiant_BSS}</b><br>${this.DataGDFPiezometry[i].y_wgs84}<br>${this.DataGDFPiezometry[i].x_wgs84}`)  
      markerpiezo.addTo(this.RegionalMapLeaflet);// Ajout du marqueur 
    }  
  }
*/
}