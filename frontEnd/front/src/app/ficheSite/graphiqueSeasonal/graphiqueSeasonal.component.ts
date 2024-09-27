import { Component, Input, SimpleChanges, OnDestroy, HostListener} from '@angular/core';
import * as Plotlydist from 'plotly.js-dist';
import { median , quantile} from 'simple-statistics';
import * as math from 'mathjs';
import { from, of, range, zip } from 'rxjs';
import { filter, groupBy, mergeMap, toArray } from 'rxjs/operators';
import { ColorService } from 'src/app/service/color-service.service';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import dataPrecipitation from 'src/app/model/dataPrecipitation';
import dataDepth from 'src/app/model/dataDepth';
import dataTemperature from 'src/app/model/dataTemperature';
import dataDischarge from 'src/app/model/dataDischarge';


/**
* Composant Angular pour les graphiques des séries temporelles dans la fiche de site
*/
@Component({
    selector: 'app-graphiqueSeasonal',
    templateUrl: './graphiqueSeasonal.component.html',
    styleUrls: ['./graphiqueSeasonal.component.scss']
})

export class graphiqueSeasonal implements OnDestroy {
  private resizeListener: ()=> void; //Gestionnaire d'événements pour la redimension de la fenêtre.
  @Input() GraphType! : string; // Type du graphique ('depth', 'temperature', 'precipitation', 'hydrograph').
  @Input() stationSelectionChange!: string; // Identifiant de la station sélectionnée
  @Input() yearSelectionChange!: number[]; // Liste des années sélectionnées

  DataStation: any[] = []; // Données pour la station selectionner
  fig: any; // Objet de configuration pour le graphique Plotly
  months: string[] = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]; //Mois de l'année (utilisés pour l'affichage sur l'axe des x).
  tickvals: string[] = this.months.map((month, index) => `${index + 1 < 10 ? '0' : ''}${index + 1}-01`); // Valeurs de graduation pour l'axe des x (format: 'MM-01').
  ticktext: string[] = this.months.map(month => month); //Texte des graduations de l'axe des x (mois de l'année).
  TabDataByDaily: any[] = []; //tableau contenant toutes les données triés
  YearTabDataByDaily: any[] = []; //tableau contenant les données  triés des années selectionné
  lastUpdate: any | null;// dernière update des données des données
  resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = []; //Tableau contenant les quantiles calculés (10%, 50%, 90%) pour les données affichées

  /**
  * Constructeur de la classe.
  * @param dataService Service de gestion des données.
  * @param jsonService Service de gestion des fichiers JSON.
  * @param colorService Service de gestion des couleurs pour le graphique.
  */
  constructor(private dataService: DataService, private jsonService: JsonService, private colorService : ColorService) {
    // Définition de l'écouteur pour ajuster la taille des graphiques en fonction de la taille de l'écran.
    this.resizeListener = () => {
      const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
      const GraphWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth;
      // Redimensionner le graphique selon le type sélectionné
      if (this.GraphType === 'depth') {
        Plotlydist.relayout('depthSeasonal', { width: GraphWidth });
      }else if (this.GraphType === 'temperature') {
        Plotlydist.relayout('temperatureSeasonal', { width: GraphWidth });
      }else if (this.GraphType === 'precipitation') {
        Plotlydist.relayout('precipitationSeasonal', { width: GraphWidth });
      }else if (this.GraphType === 'hydrograph') {
        Plotlydist.relayout('hydrographSeasonal', { width: GraphWidth });
      }
    };
  }
  
  /**
  * Écouteur d'événements pour le redimensionnement de la fenêtre.
  * Appelle `resizeListener` à chaque redimensionnement.
  * 
  * @param event L'événement de redimensionnement.
  */
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeListener();
  }

  /**
  * Initialisation du composant.
  * Cette méthode est appelée une fois que les propriétés @Input ont été initialisées.
  */
  ngOnInit() {
    // Ajout de l'écouteur pour la redimension de fenêtre
    window.addEventListener('resize', this.resizeListener);
    // Initialisation du graphique selon le type de données sélectionné
    if(this.GraphType == 'depth'){
      this.initStationDepth(this.stationSelectionChange);
    }else if (this.GraphType == 'temperature'){
      this.initStationTemperature(this.stationSelectionChange);
    }else if (this.GraphType == 'precipitation'){
      this.initStationPrecipitation(this.stationSelectionChange);
    } else if (this.GraphType == 'hydrograph'){
      this.initStationDischarge(this.stationSelectionChange);
    }else {
      console.log("type de graphique non valide")
    }   
  }
  
  /**
  * Méthode appelée lorsque le composant est détruit.
  * Retire l'écouteur d'événements pour le redimensionnement.
  */
  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  /**
   * Méthode déclenchée lors de changements des propriétés @Input.
   * Gère l'initialisation du graphique en fonction des changements.
   * 
   * @param changes Objet contenant les nouvelles valeurs des @Input.
   */
  ngOnChanges(changes: SimpleChanges) {
    // Vérification si la station a changé, réinitialiser le graphique correspondant
    if (changes['stationSelectionChange']) {
      if(this.GraphType == 'depth'){
        this.initStationDepth(changes['stationSelectionChange'].currentValue);
      }else if (this.GraphType == 'temperature'){
        this.initStationTemperature(changes['stationSelectionChange'].currentValue);
      }else if (this.GraphType == 'precipitation'){
        this.initStationPrecipitation(changes['stationSelectionChange'].currentValue);
      } else if (this.GraphType == 'hydrograph'){
        this.initStationDischarge(changes['stationSelectionChange'].currentValue);
      }else {
        console.log("type de graphique non valide")
      } 
    }
    // Gestion du changement des années sélectionnées
    else if(changes['yearSelectionChange']){
      if(this.GraphType == 'depth'){
        this.create_graph_seasonal("depth", this.DataStation) 
      }else if (this.GraphType == 'temperature'){
        this.create_graph_seasonal("temperature", this.DataStation) 
      }else if (this.GraphType == 'precipitation'){
        this.create_graph_seasonal("precipitation", this.DataStation) 
      }else if (this.GraphType == 'hydrograph'){
        this.create_graph_seasonal("hydrograph", this.DataStation) 
      }else {
        console.log("type de graphique non valide")
      } 
    }
  }

  /**
  * récupère les données de profondeur d'une station 
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv
  * @param stationID 
  */
  initStationDepth(stationID: string){
    this.jsonService.getDepth(stationID).then((station: dataDepth[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("depth", this.DataStation) 
    });
  }  

  /**
  * Initialise les données de précipitations pour une station donnée.
  * contenus: name(string), id(string), t(string), Q(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID Identifiant de la station
  */
  initStationPrecipitation(stationID: string) {
    this.jsonService.getPrecipitation(stationID).then((station: dataPrecipitation[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("precipitation", this.DataStation) 
    });
  }

  /**
  * Initialise les données de température pour une station donnée.
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID Identifiant de la station sélectionnée
  */
  initStationTemperature(stationID: string){
    this.jsonService.getTemperature(stationID).then((station: dataTemperature[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("temperature", this.DataStation) 
    });
  }

  /**
  * Initialise les données de débit pour une station donnée.
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID L'ID de la station sélectionnée.
  */
  initStationDischarge(stationID: string) {
    this.jsonService.getDischarge(stationID).then((station: dataDischarge[]) => {
      this.DataStation = station;
      this.create_graph_seasonal("hydrograph", this.DataStation) 
    });
  }

   
  /**
  * Traite les données pour les rendre utilisables dans les graphiques, en prenant en compte les précipitations et d'autres types de données.
  *
  * Étapes principales :
  * 1. Vérifier la présence de données et initialiser les structures de sortie.
  * 2. Parcourir chaque entrée de données :
  *    - Convertir et formater la date.
  *    - Mettre à jour la dernière date de mise à jour.
  *    - Créer des nouvelles entrées selon le type de données (profondeur, précipitation, etc.).
  *    - Filtrer les données valides et ajouter à la liste des données journalières.
  *    - Maintenir une liste des années uniques.
  * 3. Si les données concernent des précipitations, calculer le cumul journalier.
  * 4. Filtrer les données pour ne conserver que les années cibles.
  * 5. Retourner les résultats traités : données journalières, données filtrées par année et dernière date de mise à jour.
  * 
  * @param typeData Type des données à traiter (ex: 'depth', 'discharge', 'precipitation','hydrograph').
  * @param data Tableau des données brutes provenant des capteurs ou de la base de données.
  * @param targetYears Liste des années cibles à inclure dans les résultats.
  * @returns Un objet contenant les données journalières (par jour), par année, ainsi que la dernière date de mise à jour.
  */
  processedData(typeData: string, data: any[], targetYears: number[]): { DataByDaily: any[], YearDataByDaily: any[], Update: any } {
    const DataByDaily: any[] = []; // Données journalières par date.
    const YearDataByDaily: any[] = []; // Données filtrées par les années cibles.
    let Update: number | Date | null = null; // La dernière mise à jour.
    let uniqueYears: number[] = []; // Liste des années uniques.
  
    // Vérifie que les données existent et qu'elles ne sont pas vides.
    if (data && data.length > 0) {
      // Parcourt chaque entrée de données.
      data.forEach(entry => {
        const date = new Date(entry.t); // Conversion de la date en objet Date.
        const year = date.getFullYear(); // Récupération de l'année.
        const monthDay = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`; //  recupere mois Format jour-mois.
        const currentDate = new Date(entry.t); // recupere la date de entrée
            
        // Mise à jour de la date de mise à jour la plus récente.
        if (!Update || currentDate > Update|| !isNaN(parseFloat(entry.t))) {
          Update = currentDate; 
        }

        // Crée une nouvelle entrée de données selon le type de données.
        let newDataEntry: any;
        if (typeData === 'depth'){// Cas des données de profondeur des nappe.
          newDataEntry = { H: entry.H, d: entry.d, t: entry.t, years: year, daily: monthDay };
          if (!isNaN(parseFloat(entry.d))) DataByDaily.push(newDataEntry);
        }else if (typeData === 'precipitation') { // Cas des données de précipitation.
          newDataEntry = { Q: entry.Q, t: entry.t, years: year, daily: monthDay };
          // Ignorer l'année 1958 et les données invalides
          if (!isNaN(parseFloat(entry.Q)) && year !== 1958) {
            DataByDaily.push(newDataEntry);
          }
        }else{// Cas par défaut pour les autres types de données (débit, temperature.).    
          newDataEntry = { Q: entry.Q, t: entry.t, years: year, daily: monthDay };
          if (!isNaN(parseFloat(entry.Q))) DataByDaily.push(newDataEntry);
        }
        // Ajoute l'année à la liste des années uniques si elle n'y figure pas encore.
        if (!uniqueYears.includes(year)) uniqueYears.push(year);
      });
  
      // Si le type de données est "precipitation", calcule le cumul journalier des précipitations.
      if (typeData === 'precipitation') {
        uniqueYears.forEach(year => {
          const yearData = DataByDaily.filter(entry => entry.years === year);// Filtrer les données par année.
          let cumulativeRainfall = 0.0;  // Cumul des précipitations.
          yearData.forEach(entry => {
            const rainfall = parseFloat(entry.Q);// Convertir la valeur en nombre.
            cumulativeRainfall += rainfall; // Ajoute la précipitation au cumul.
            entry.cumulative_daily_rainfall = cumulativeRainfall; // Mise à jour du cumul.
          });
        });
      }
      // Filtre les données par les années cibles.
      DataByDaily.forEach(entry => {
        if (targetYears.includes(entry.years)) YearDataByDaily.push(entry);
      });
    }
    return { DataByDaily, YearDataByDaily, Update }; // Retourne les résultats traités.
  }

  /**
  * Calcule les quantiles (10%, 50%, 90%) sur les données en fonction du type de données fourni.
  *   
  * Étapes principales :
  * 1. Déterminer la clé de valeur à extraire selon le type de données.
  * 2. Filtrer les données pour exclure les valeurs non numériques.
  * 3. Regrouper les données par jour.
  * 4. Calculer les quantiles (10%, 50%, 90%) pour chaque jour.
  * 5. Trier les résultats par date (mois-jour).
  * 6. Retourner les résultats avec les quantiles calculés.
  * 
  * @param data Tableau de données à analyser.
  * @param typeData Type des données à traiter (par exemple: 'depth', 'temperature', 'precipitation').
  * @returns Un objet contenant les quantiles journaliers (q10, q50, q90) et globaux.
  */
  calculateQuantiles(typeData: string,data: any[]): { resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[], q10: any, q50: any, q90: any } {
    const resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = [];// Résultats des quantiles pour chaque jour.
    let q10: any; // Quantile 10%
    let q50: any; // Quantile 50%
    let q90: any; // Quantile 90%

    // Déterminer la clé de valeur en fonction du type de données.
    let valueKey: string;
    let excludeYears: number[] = []; // Années à exclure (non utilisé ici).
  
    // type de  valeur à extraire selon les données
    switch (typeData) {
      case 'depth':
        valueKey = 'd';
        break;
      case 'hydrograph':
        valueKey = 'Q';
        break;
      case 'temperature':
        valueKey = 'Q';
        break;
      case 'precipitation':
        valueKey = 'cumulative_daily_rainfall';
        break;
      default:
        throw new Error('Invalid data type');
    }
  
    // Transformation des données pour calculer les quantiles par jour.
    from(data)
      .pipe(
        filter(entry => !isNaN(parseFloat(entry[valueKey]))),// Filtrer les données NaN.
        groupBy(
          entry => entry.daily, // Regrouper par jour (clé).
          p => parseFloat(p[valueKey])// Extraire les valeurs numériques.
        ),
        mergeMap(group => zip(of(group.key), group.pipe(toArray()))) // Fusionner les groupes avec leurs clés.
      )
      .subscribe({
        // Pour chaque groupe (jour), calculer les quantiles.
        next: ([key, values]) => {
          const numericValues: number[] = values.map(value => parseFloat(value.toString())); // Conversion en nombre
          // Calcule les quantiles (10%,50%,90%)
          q10 = (math.quantileSeq(numericValues, 0.1));// Calcul du quantile 10%.
          q10 =parseFloat(q10.toFixed(4));//arrondi q10 4 chiffres après la virgule
          q50 = median(numericValues); // Calcul du quantile 50%.
          q50 = parseFloat(q50.toFixed(4));//arrondi q50 4 chiffres après la virgule
          q90 = math.quantileSeq(numericValues, 0.9); // Calcul du quantile 90%.
          q90 = parseFloat(q90.toFixed(4)); //arrondi q90 4 chiffres après la virgule    
          /*
          const entry = { key, values: numericValues, q10, q50, q90 };
          resultArray.push(entry);
          */
          resultArray.push({ key, values: numericValues, q10, q50, q90 });// Enregistrement des résultats.
        }
      });
      // Tri des résultats par date (mois-jour).
      resultArray.sort((a, b) => {
        const [aMonth, aDay] = a.key.split('-').map(Number);
        const [bMonth, bDay] = b.key.split('-').map(Number);
        if (aMonth !== bMonth) {
          return aMonth - bMonth;
        } else {
          return aDay - bDay;
        }
    });
    return { resultArray, q10, q50, q90 }; // Retourne les quantiles.
  }


  /**
  * Crée un graphique des séries temporelles basé sur le type de données spécifié.
  *
  * Étapes principales :
  * 1. Initialisation des paramètres spécifiques au type de données (titre du graphique, nom des axes, lien source, etc.).
  * 2. Traitement des données en fonction du type choisi (profondeur, précipitation, température, débit).
  * 3. Calcul des quantiles (q10, q50, q90) pour définir les plages de variabilité des données.
  * 4. Construction de la figure Plotly avec les séries de données (médiane, variabilité, années sélectionnées).
  * 5. Configuration des axes, annotations et mise en page du graphique.
  * 6. Ajout des tracés pour les années sélectionnées.
  * 7. Mise à jour de l'annotation pour indiquer la dernière date de mise à jour des données.
  * 8. Affichage du graphique Plotly et ajustement en fonction de la taille de l'écran.
  * 
  * @param datatype - Type de données à visualiser (ex: 'depth', 'precipitation', 'temperature', 'hydrograph').
  * @param data - Données à afficher, contenant des informations spécifiques selon le type de données.
  */
  create_graph_seasonal(datatype : string, data : any[]) {
      // Liste des années sélectionnées par l'utilisateur
      const targetYears: number[] = this.yearSelectionChange;
      // Variables pour stocker les informations de configuration du graphique changeant selon le type
      let titleGraph = null // Titre du graphique
      let nameYaxis = null // Nom de l'axe Y
      let hyperlien = null // Lien source pour plus d'infos (hyperlien)
      let namehyperlien = null // Nom de la source pour le lien
      let hovertemplatename = null // Modèle de l'infobulle pour chaque point de données
      // Bloc conditionnel pour les différents types de données
      if(datatype == "depth"){
        // Configuration spécifique pour la profondeur de nappe (depth)
        titleGraph = 'Profondeur de la nappe [' + data[1] + ']' 
        nameYaxis ='Profondeur [m]'
        hyperlien = `https://ades.eaufrance.fr/Fiche/PtEau?Code=${data[1]}`
        namehyperlien = 'ADES'
        hovertemplatename = 'moyenne: %{y:.1f} m<extra></extra>'

        // Traitement et stockage des données pour la profondeur de nappe
        const  { DataByDaily, YearDataByDaily, Update } = this.processedData('depth', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;// Dernière mise à jour des données

        // Calcul des quantiles (q10, q50, q90)
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('depth',this.TabDataByDaily);
        this.resultArray = resultArray;

      }else if(datatype == "precipitation") {
        // Configuration spécifique pour les précipitations
        titleGraph = 'Précipitations'
        nameYaxis = 'Cumul des précipitations [mm]'
        hyperlien = "https://meteo.data.gouv.fr/datasets/6569b27598256cc583c917a7"
        namehyperlien = 'Météo France'
        hovertemplatename = 'moyenne: %{y:.1f} mm<extra></extra>'

        // Traitement et stockage des données pour les precipitations
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('precipitation', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update; // Dernière mise à jour des données

       // Calcul des quantiles (q10, q50, q90)
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('precipitation', this.TabDataByDaily);
        this.resultArray = resultArray;

      }else if (datatype == "temperature"){
        // Configuration spécifique pour l'évapotranspiration(température )
        titleGraph = 'Evapotranspiration'
        nameYaxis = 'Evapotranspiration [mm/jour]]'
        hyperlien = "https://meteo.data.gouv.fr/datasets/6569b27598256cc583c917a7"
        namehyperlien = 'Météo France'
        hovertemplatename = 'moyenne: %{y:.1f} mm/jour<extra></extra>'

        // Traitement et stockages des données pour l'évapotranspiration
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('temperature', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;// Dernière mise à jour des données

        // Calcul des quantiles (q10, q50, q90)
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('temperature', this.TabDataByDaily);
        this.resultArray = resultArray;

      }else if(datatype == "hydrograph"){
        // Configuration spécifique pour les debits de cours d'eau(hydrograph)
        titleGraph = 'Débits de cours d\'eau [' + data[1] + ']'
        nameYaxis = 'Débit de cours d\'eau [m3/s]'
        hyperlien = `https://www.hydro.eaufrance.fr/sitehydro/${data[1]}/fiche`;
        namehyperlien = 'DREAL Bretagne'
        hovertemplatename = '%{y:.3f} m3/s<extra></extra>'

         // Traitement et stockagedes données pour les debits de cours d'eau
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('hydrograph', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;// Dernière mise à jour des données

        // Calcul des quantiles (q10, q50, q90 )
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('hydrograph', this.TabDataByDaily);
        this.resultArray = resultArray;
      }

    // Préparation des données de la zone de variabilité pour le graphique Plotly
    const resultArraysKeys = this.resultArray.map(entry => entry.key); // Obtenir les dates (x-axis)
    const variabilityX = resultArraysKeys.concat(resultArraysKeys.slice().reverse()); // stocker les valeurs de l'axe x (date + date.inversée) 
    const resultArrayq10 = this.resultArray.map(entry => entry.q10); //Obtenir les valeurs de q10
    const resultArrayq90 = this.resultArray.map(entry => entry.q90); //Obtenir les valeurs de q90
    const variabilityY =  resultArrayq10.concat(resultArrayq90.slice().reverse()); // stocker les valeurs de l'axe y (q10 + q90.inversée )
        
    // Calcul des valeurs maximales et minimales pour l'axe Y (pour 'depth' uniquement)
    let max = -Infinity;
    let min = Infinity;
    this.resultArray.forEach(entry => {
      max = Math.max(max, entry.q10 || -Infinity, entry.q90 || -Infinity); // Calculer le maximum
      min = Math.min(min, entry.q10 || Infinity, entry.q90 || Infinity); // Calculer le minimum
    });
       
    // Configuration du graphique Plotly (axes, légendes, etc.)
    this.fig = {
      data: [], // Initialisation d'un tableau vide pour stocker les tracés (les séries de données à afficher)
      // Définition de la mise en page du graphique (axes, titres, légendes, etc.)
      layout: {
        title: { 
          text: titleGraph, // Titre du graphique
          font: {family: "Segoe UI Semibold", size: 22, color: "black"} // Style du titre
        },
        xaxis: { 
          type: 'category',  // Type d'axe X (non numérique)
          'tickvals' : this.tickvals, // Valeurs de graduation sur l'axe X
          'ticktext' : this.ticktext, // Texte associé aux valeurs des graduation
          tickfont: {size: 14, family: 'Segoe UI Semibold', color: 'black'}, //style des graduation
          'gridwidth' : 0.01, // Largeur des lignes de la grille sur l'axe X
          'gridcolor' : 'rgba(0,0,0,0.1)'// Couleur des lignes de la grille (gris)
        },
        yaxis: { 
          title: nameYaxis, // Titre de l'axe Y
          font: {family: "Segoe UI Semibold", size: 16, color: "black"}, // Style du titre de l'axe Y
          showticklabels: true, // Afficher les étiquettes de graduation
          tickfont: { size: 14, family: 'Segoe UI Semibold', color: 'black'}, //style des graduation
          gridwidth: 0.01, // Largeur des lignes de la grille de l'axe Y
          gridcolor: 'rgba(0,0,0,0.1)', // Couleur des lignes de la grille (gris)
          // Si le type de données est "depth", définir la plage de l'axe Y (ajuster les limites min et max)
          ...(datatype === 'depth' && {range: [(max + (max * 0.05)), (min - (min * 0.05))]}), 
          // Si le type de données est "hydrograph", utiliser un axe logarithmique avec des puissances
          ...(datatype === 'hydrograph' && {type: 'log', exponentformat: 'power'})
        },
        annotations:[
          {// Annotation indiquant la date de dernière mise à jour  
            text: 'Mis à jour le : '+ this.lastUpdate, 
            showarrow: false, // Ne pas afficher de flèche
            xref: 'paper', // Référence de l'axe X (par rapport au papier du graphique)
            yref: 'paper', // Référence de l'axe Y (par rapport au papier du graphique)
            x: 0.5, // Position sur l'axe X (centrée)
            y: 1.15, // Position sur l'axe Y (au-dessus du graphique)
            font: {"family": "Segoe UI", "size": 14, "color": "#999"} // Style du texte 
          },
          {// annotation Lien hypertexte vers la source des données
            text: `<a href="${hyperlien}" style="color:#999; font-family: Segoe UI; font-size: 14px;">Source : ${namehyperlien}</a>`,
            showarrow: false, // Ne pas afficher de flèche
            xref: 'paper', // Référence de l'axe X (par rapport au papier du graphique)
            yref: 'paper', // Référence de l'axe Y (par rapport au papier du graphique)
            x: 0.5, // Position sur l'axe X (centrée)
            y: -0.20, // Position sur l'axe Y (en-dessous du graphique)
            font: {"size":14, "color":"#999", "family":'Segoe UI'} 
          }
        ],
        margin: { t: 125 }, // Marges supérieures pour laisser de l'espace pour le titre et les annotations
        title_x: 0.5, // Centrage du titre du graphique
        hovermode: "x unified", // Mode d'affichage des infobulles, unifié sur l'axe X
        plot_bgcolor: "rgba(0,0,0,0)", // Couleur de fond de la zone de traçage (transparent)
        paper_bgcolor: "rgba(0,0,0,0)", // Couleur de fond du papier du graphique (transparent)
        legend: { orientation: "h", yanchor: "top", y: 1.1, xanchor: "right", x: 1 } // Légende horizontale, ancrée en haut à droite
      }
    };
      
    // Construction du libellé pour les tracés (médiane et variabilité)
    const startYear = this.TabDataByDaily.length > 0 ? this.TabDataByDaily[1].years : 'N/A'; // Année de début de la série de données
    const endYear = this.TabDataByDaily.length > 0 ? this.TabDataByDaily[this.TabDataByDaily.length - 1].years : 'N/A'; // Année de fin de la série de données
    const labelmedian = `moyenne [${startYear} - ${endYear}]`; // Libellé pour la médiane
    const labelinvariant = `variabilité [${startYear} - ${endYear}]`; // Libellé pour la zone de variabilité
  
    // Trace de la médiane (q50)
    this.fig.data.push({
      x: this.resultArray.map(item => item.key), // Valeurs sur l'axe X (jours-mois)
      y: this.resultArray.map(item => item.q50), // Valeurs de la médiane (q50) sur l'axe Y
      mode: 'lines', // Tracé en lignes
      name: labelmedian, // Nom du tracé (affiché dans la légende)
      line: { color: 'black', width: 1.5, dash : 'dot' }, // Style de la ligne (noir, pointillée)
      hovertemplate: hovertemplatename,// Modèle d'infobulle pour afficher les données
    });
  
    // Trace de la zone de variabilité (q10 - q90)
    this.fig.data.push({
      x: variabilityX, // Ensemble des valeurs de l'axe X pour la zone de variabilité ( dates + dates.inversées)
      y: variabilityY, // Ensemble des valeurs de l'axe Y pour la zone de variabilité (q10 + q90.inversées)
      fill: 'tozeroy', // Remplir la zone jusqu'à l'axe Y
      fillcolor: 'rgba(183, 223, 255, 0.3)', // Couleur de remplissage (bleu clair transparent)
      mode: 'none',  // Pas de ligne visible
      name: labelinvariant, // Nom du tracé (affiché dans la légende)
      hoverinfo: 'none' // Pas d'infobulle sur la zone de variabilité
    });

    // Boucle sur les années sélectionnées
    for (let i = 0; i < targetYears.length; i++) {
      const year = targetYears[i];// Année sélectionnée
      const df_event = this.YearTabDataByDaily.filter(item => item.years === year); // Filtrer les données pour cette année
      if (df_event) {
        // Choisir la bonne valeur pour y selon dataType (depth, precipitation,temperature ou hydrograph)
        const yValues = df_event.map(item => 
          datatype === 'depth' ? item.d :
          datatype === 'precipitation' ? item.cumulative_daily_rainfall : 
          item.Q
        );

        const trace = {
          x: df_event.map(item => item.daily), // dates sur l'axe X
          y: yValues, // Valeurs sur l'axe Y correspondant aux données de l'année
          mode: 'lines', // Tracé en lignes
          name: String(year), // Nom du tracé (affichée dans la légende)
          line: { color: this.colorService.getColorForYear(year,targetYears.length), width: 1.5 }, // Style de la ligne (couleur par année)
          hovertemplate: `${year}: ` + hovertemplatename, // Modèle d'infobulle pour afficher les données
        };
        this.fig.data.push(trace);// Ajouter le tracé pour cette année aux données du graphique
      }
    }
      
    // Mettre à jour l'annotation pour afficher la date de mise à jour actuelle
    if (this.lastUpdate){   
      // Formater la date de mise à jour    
      const currentDate = `${this.lastUpdate.getDate().toString().padStart(2, '0')}-${(this.lastUpdate.getMonth() + 1).toString().padStart(2, '0')}-${this.lastUpdate.getFullYear()}`;
      // Trouver l'annotation existante
      const updatedAnnotation = this.fig.layout.annotations.find((annotation: any) => annotation.text.includes('Mis à jour le :'));
      if (updatedAnnotation) {
        // Mettre à jour le texte avec la nouvelle date
        updatedAnnotation.text = `Mis à jour le : ${currentDate}`;
      }
    }
    
    // Tracer la figure Plotly en fonction de la largeur de l'écran
    const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches; // Détecter si l'écran est petit
    const graphWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth; // Ajuster la largeur du graphique
    // Créer le graphique et ajuste le graphique celon la taille de l'ecran et le type de donnée
    if (this.GraphType == 'depth'){
      Plotlydist.newPlot('depthSeasonal', this.fig.data, this.fig.layout, { responsive: true });
      Plotlydist.relayout('depthSeasonal', { width: graphWidth});
    }else if (this.GraphType == 'temperature'){
      Plotlydist.newPlot('temperatureSeasonal', this.fig.data, this.fig.layout, { responsive: true });
      Plotlydist.relayout('temperatureSeasonal', { width: graphWidth});
    }else if (this.GraphType == 'precipitation'){
      Plotlydist.newPlot('precipitationSeasonal', this.fig.data, this.fig.layout, { responsive: true });
      Plotlydist.relayout('precipitationSeasonal', { width: graphWidth});
    }else if (this.GraphType == 'hydrograph'){
      Plotlydist.newPlot('hydrographSeasonal', this.fig.data, this.fig.layout, { responsive: true });
      Plotlydist.relayout('hydrographSeasonal', { width: graphWidth});
    }  
  }

  /*
  * Fonction permettant de générer et télécharger un fichier CSV contenant des données météorologiques ou hydrologiques
  * selon le type de graphique (profondeur, précipitation, hydrographie ou température). 
  * Le CSV contient les colonnes pour les quantiles Q10, Q50, Q90, ainsi que les valeurs par année sélectionnée. 
  * 
  * Étapes principales :
  * 1. Fusionner les données de la médiane (Q10, Q50, Q90) et les données par année dans un objet.
  * 2. Construire le contenu du fichier CSV avec l'en-tête et les données.
  * 3. Générer un fichier Blob à partir des données CSV.
  * 4. Créer et déclencher le téléchargement du fichier CSV.
  * 5. Libérer les ressources utilisées pour la génération du fichier.
  */
  downloadCSV(){
    // mettre en place le nom du fichier celon le type du graphique
    let fileName = ''
    if (this.GraphType == 'depth'){
      fileName = `profondeur_de_la_nappe[${this.DataStation[1]}].csv`;
    }else if (this.GraphType == 'precipitation'){
      fileName = `précipitation.csv`;
    }else if(this.GraphType == 'hydrograph'){
      fileName = `debit_seasonal[${this.DataStation[1]}].csv`;
    }else if(this.GraphType == 'temperature'){
      fileName = `evapotranspiration.csv`;
    }
    // Initialiser un objet pour stocker les données fusionnées
    const mergedData: { [key: string]: { [year: string]: number | null, q10: number | null ,q50: number | null, q90: number | null} } = {};
    // Initialiser les années présentes dans yearTabDepth
    const years = this.yearSelectionChange; 

    // Ajouter les données de resultArray
    for (const result of this.resultArray) {
      mergedData[result.key] = {
        q10: result.q10 !== undefined ? result.q10 : null,
        q50: result.q50 !== undefined ? result.q50 : null,
        q90: result.q90 !== undefined ? result.q90 : null,
      };
    }

    // Ajouter les données de yearTabDepth
    for (const entry of this.YearTabDataByDaily) {
      mergedData[entry.daily][`${entry.years}`] = entry.d;
    
    }                            
    // Initialisation de la chaîne CSV avec l'en-tête initial
    let csv = 'Date,Q90,Q50,Q10';
    // Ajouter les années à l'en-tête CSV
    this.yearSelectionChange.forEach(year => {
      csv += `,${year}`;
    });
    // Ajouter une nouvelle ligne pour le CSV
    csv += '\n';

    // Parcours de mergedData pour construire le CSV
    Object.keys(mergedData).forEach(date => {
      // Reformater la date au format souhaité si nécessaire
      const formattedDate = date; // Assurez-vous de reformater correctement la date si nécessaire
      // Extraire les valeurs q10, q50, q90
      const q10 = mergedData[date]['q10'] !== null ? mergedData[date]['q10'] : '';
      const q50 = mergedData[date]['q50'] !== null ? mergedData[date]['q50'] : '';
      const q90 = mergedData[date]['q90'] !== null ? mergedData[date]['q90'] : '';    
      // Construire la ligne CSV pour chaque date
      let csvLine = `${formattedDate},${q90},${q50},${q10}`;
      // Ajouter les données spécifiques aux années
      years.forEach(year => {
        const value = mergedData[date][year] !== null ? mergedData[date][year] : '';
        csvLine += `,${value}`;
      });
      // Ajouter une nouvelle ligne pour le CSV
      csvLine += '\n';
      // Ajouter la ligne au CSV final
      csv += csvLine;
    });
    
    // Créer le Blob à partir du CSV
    const blob = new Blob([csv], { type: 'text/csv' }); 
    // Créer l'URL du Blob
    const url = window.URL.createObjectURL(blob);
    // Créer un élément <a> pour le téléchargement du fichier
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;  
    // Ajouter l'élément <a> au corps du document
    document.body.appendChild(a);  
    // Simuler un clic sur le lien pour déclencher le téléchargement
    a.click();  
    // Supprimer l'élément <a> du corps du document
    document.body.removeChild(a);  
    // Révoquer l'URL du Blob pour libérer la mémoire
    window.URL.revokeObjectURL(url);           
  }   
}