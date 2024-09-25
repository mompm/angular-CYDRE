import { Options } from '@angular-slider/ngx-slider/options';
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, SimpleChange, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import * as Plotly from 'plotly.js-dist';
import { Layout, PlotData } from 'plotly.js';
import { JsonService } from 'src/app/service/json.service';
import { AxisType } from 'plotly.js-dist';
import * as Papa from 'papaparse';
import { index, string } from 'mathjs';
import * as e from 'express';

// format des indicateurs
interface Indicator {
  id: string;
  type: string;
  value: number;
  color: string;
  fixed: boolean;
  modified : boolean;
}

/**
 * component de la visualisation des resultats de la simulation
 */
@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss'],
})
export class SimulationResultsComponent implements OnInit, OnDestroy {
@Input() simulation_id: string | undefined | null = null; // Propriété d'entrée pour l'ID de la simulation
@Input() showResults: boolean = false;// Propriété d'entrée pour afficher ou non les résultats
@Input() watershedID: string | null | undefined;// Propriété d'entrée pour l'ID du bassin versant
@Input() showAdditionialMatrix = false; // Propriété d'entrée pour afficher ou non des matrices supplémentaires(false= uniquement scenario)


@ViewChild(MatPaginator) paginator!: MatPaginator;// Pagination pour le tableau utilisé pour la gestion du tableau des coefficients
@ViewChild(MatSort) sort!: MatSort;// Tri pour le tableau utilisé pour la gestion du tableau des coefficients
displayedColumns: string[] = ['Year', 'ID', 'Coeff'];// Colonnes affichées dans le tableau des coefficients
dataSource: MatTableDataSource<any> | undefined;// Source des données pour le tableau des coefficients


private resizeListener: () => void;// Écouteur pour la redimension des fenêtres (resize)

// ===== VARIABLES LIÉES AUX RÉSULTATS =====
// Contient les résultats provenant du simulateur (simulateur-cydre)
// Pour accéder aux résultats, utilisez this.results
@Input() results: any = {
  indicators: [], // Liste des indicateurs
  results: { 
    corr_matrix: "", // Matrice de corrélation
    data: "", // Données générales
    similarity: {
      corr_matrix: { // Matrice de corrélation pour la recharge et le débit spécifique
        recharge: "",
        specific_discharge: ""
      },
      selected_scenarios: "", // Scénarios sélectionnés
      similar_watersheds: "", // Bassins versants similaires
      user_similarity_period: "" // Période de similarité sélectionnée par l'utilisateur
    }
  }
};

// ===== VARIABLES LIÉES AUX INDICATEURS =====

tooltipTextsEstimationValue: string[] = [];// Textes des info-bulles pour les valeurs d'estimation des indicateurs
indicators: Array<Indicator> = [];// Tableau contenant les indicateurs
IDIndicators: number = 0;// Compteur pour attribuer des IDs uniques aux indicateurs
// Schéma de couleurs pour les graphiques (nom, sélection, groupe de couleurs, domaine de couleurs)
colorScheme: Color = {
  name: 'default',
  selectable: true,
  group: ScaleType.Ordinal,
  domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
};

// ===== VARIABLES LIÉES AUX MATRICES DE CORRÉLATION =====

selectedMatrix: string = 'all';// Matrice sélectionnée ('all' par défaut)
matricecolumn: boolean = false;// Indique si la matrice doit être présentée en colonne (lorsque trop large pour l'affichage)
scenariosMatrixFontSize: number = 11;// Taille de la police pour les matrices de scénarios
similarScenarios: number = 0;// Nombre de scénarios similaires trouvés
scenarios: any;// Liste des scénarios disponibles
displayedColumnsScenarios: string[] = [];// Colonnes affichées pour les scénarios dans la matrice
allColumns: string[] = [];// Toutes les colonnes disponibles pour les scénarios
scenariosHeatMap: any;// Données pour la heatmap (carte thermique) des scénarios
// Échelle de couleurs pour la heatmap
colorScale = [
  ['0.0', 'rgb(165,0,38)'],
  ['0.111111111111', 'rgb(215,48,39)'],
  ['0.222222222222', 'rgb(244,109,67)'],
  ['0.333333333333', 'rgb(253,174,97)'],
  ['0.444444444444', 'rgb(254,224,144)'],
  ['0.555555555556', 'rgb(224,243,248)'],
  ['0.666666666667', 'rgb(171,217,233)'],
  ['0.777777777778', 'rgb(116,173,209)'],
  ['0.888888888889', 'rgb(69,117,180)'],
  ['1.0', 'rgb(49,54,149)']
];

// ===== VARIABLES LIÉES AU GRAPHIQUE DU MODÈLE DE PRÉVISION =====

XaxisObservations: Date[] = [];// Données d'observation pour l'axe X (dates)
XaxisPredictions: Date[] = [];// Données de prédiction pour l'axe X (dates)
on: boolean = false;// Indicateur de l'état du graphique (activer ou désactiver l'affichage log/linéaire)
type: any = "log";// Type d'échelle pour l'axe Y (logarithmique ou linéaire)
maxPredictedValue: number[] = [];// Valeurs maximales prédictions (pour l'axe Y)
yMin = 0;// Valeur minimale de l'axe Y
yMax = 0;// Valeur maximale de l'axe Y
range: number[] = [];// Intervalle de l'axe Y (min et max)
simulationStartDate: Date | undefined;// Date de début de la simulation pour l'axe X
simulationEndDate: Date | undefined;// Date de fin de la simulation pour l'axe X
endDate: Date | undefined;// Date de fin des données pour l'axe X
startDate: Date = new Date(this.results.results.similarity.user_similarity_period[0]);// Date de début des données pour l'axe X 
traces: Plotly.Data[] = [];// Traces du graphique (données de série à tracer)
layout: Partial<Plotly.Layout> | undefined;// Mise en page du graphique (layout personnalisé)
stations: any[] = [];// Liste des stations hydrologiques
stationName: string | null | undefined; // Nom de la station sélectionnée 

 
  /**
  * Constructeur du composant
  * @param jsonService Service pour manipuler les données au format JSON
  * @param dialog Service pour afficher les dialogues (boîtes de dialogue)
  * @param cdr Détecteur de changements permettant de forcer une mise à jour de la vue
  */
  constructor(private jsonService: JsonService, public dialog : MatDialog, private cdr: ChangeDetectorRef){
     // Listener permettant de redimensionner les matrices et le graphique en fonction de la taille de la fenêtre
    this.resizeListener = () => {
      const previsionGraphWidth = window.innerWidth * 0.80;
      Plotly.relayout('previsions', { width: previsionGraphWidth});
      if(this.matricecolumn){
        const matricewidth = 0.50 * window.innerWidth;
        Plotly.relayout('matriceRecharge',{width :matricewidth});
        Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
      }else{
        const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
        const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.30 * window.innerWidth;
        Plotly.relayout('matriceRecharge',{width :matricewidth});
        Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
        Plotly.relayout('matriceScenarios',{width :this.calculateMatrixWidth('matriceScenarios',this.createMatrixStationLabel(this.results.results.scenarios.columns),this.scenariosMatrixFontSize)});
      }
    };
  }

  // ===== METHODES CYCLE DE VIE ANGULAR =====

  /**
   * Méthode exécutée au démarrage du composant (ngOnInit)
   * Initialise les données et crée les graphiques
   */
  async ngOnInit(): Promise<void> {
    // Ajout d'un listener pour redimensionner les graphiques lors du changement de taille de fenêtre
    window.addEventListener('resize', this.resizeListener);
    // Récupère l'ID de la dernière simulation stockée dans sessionStorage
    this.simulation_id = sessionStorage.getItem('lastSimulationId') ? sessionStorage.getItem('lastSimulationId') : null;
    // Initialisation des données des stations GDF
    await this.initGDFStations();
    
    // Gestion des données de résultats
    try {
        if(this.results.results.data){ // Générer les traces du graphe
            // Gère l'erreur si this.results.results.data est un string et non un objet JSON
            if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
                try {
                    // Nettoyer les valeurs non valides dans la chaîne JSON
                    let cleanedData = this.results.results.data
                        .replace(/NaN/g, 'null')
                        .replace(/Infinity/g, 'null')
                        .replace(/-Infinity/g, 'null');
                    // Conversion de la chaîne nettoyée en objet JSON
                    this.results.results.data = JSON.parse(cleanedData);
                } catch (e) {
                    console.error('La conversion de la chaîne en objet a échoué :', e);
                }
            }
            // Mise en place de la liste des dates d'observations et prédictions
            this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date, this.results.results.data.last_observation_date);
            this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date, this.results.results.data.last_prediction_date);
        } else {
            console.log("Données manquantes lors de la création des traces du graphe");
        }
    } catch (error) {
        console.log("Problème lors de la création des traces du graphe : " + error);
    }

    // Gestion de la matrice de corrélation
    try {
        if (this.results.results.corr_matrix) { // Création de la matrice de corrélation
            if (this.results.results.data) {
                // Gère si this.results.results.data est une chaîne String
                if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
                    try {
                        // Nettoyage des valeurs non valides dans la chaîne JSON
                        let cleanedData = this.results.results.data
                            .replace(/NaN/g, 'null')
                            .replace(/Infinity/g, 'null')
                            .replace(/-Infinity/g, 'null');
                        // Conversion de la chaîne nettoyée en objet JSON
                        this.results.results.data = JSON.parse(cleanedData);
                    } catch (e) {
                        console.error('La conversion de la chaîne en objet a échoué :', e);
                    }
                }
                // Mise en place des données pour le tableau des données de corrélation
                this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;
            } else {
                console.log("Données manquantes lors du chargement de la matrice de corrélation");
            }
        }
    } catch (error) {
        console.log("Problème lors du chargement de la matrice de corrélation : " + error);
    }

    // Gestion des indicateurs
    try {
        if (this.results.indicators) { // Création du tableau contenant les indicateurs
            this.fillIndicators();
        } else {
            console.log("Données manquantes lors du chargement des indicateurs");
        }
    } catch (error) {
        console.log("Problème lors du chargement des indicateurs : " + error);
    }

    // Gestion des colonnes de la matrice de similarité
    if (this.results.results.similarity) {
        const columns = this.results?.results?.similarity?.corr_matrix?.specific_discharge?.columns;
        this.matricecolumn = columns && columns.length > 15;
    }

    // Gestion des matrices de similarités
    try { // Création des matrices de similarités
        if (this.results.results.similarity && this.showAdditionialMatrix) {
            this.cdr.detectChanges();
            this.matriceRecharge();
            this.matriceSpecificDischarge();
        } else {
            console.log("Données manquantes lors du chargement des matrices de similarités");
        }
    } catch (error) {
        console.log("Problème lors du chargement des matrices de similarités : " + error);
    }

    // Gestion de la matrice de similarité des scénarios
    try { // Création de la matrice de similarité des scénarios
        if (this.results.results.scenarios) {
            this.cdr.detectChanges();
            this.createScenariosHeatmap();
            console.log("Scénarios OK");
        } else {
            console.log("Données manquantes lors du chargement du tableau des scénarios");
        }
    } catch (error) {
        console.log("Problème lors du chargement du tableau des scénarios : " + error);
    }
  }

  /**
  * Méthode appelée lorsque le composant est détruit.
  * Retire l'écouteur d'événements pour le redimensionnement.
  */
  ngOnDestroy(){
    window.removeEventListener('resize', this.resizeListener);//détruire le listener
  }

  /**
  * récupère les données des gdf des stations
  * contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
  * contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
  * contenus dans geometry: coordinates et type 
  * location du fichier origine :backend/data/stations.csv
  */
  async initGDFStations() {
    await this.jsonService.getGDFStations().then(data => {
      this.stations = data;
      console.log(this.stations)
      this.cdr.detectChanges();
    });
  }

  /**
  * Méthode appelée après que la vue du composant a été initialisée
  * Met à jour les composants avec les résultats obtenus
  */
  ngAfterViewInit() {
    this.updateComponentsWithResults(this.results);
  }

  /**
  * Méthode appelée lorsqu'il y a des changements dans les propriétés d'entrée
  * @param changes - Les changements de propriété détectés
  */
  ngOnChanges(changes: SimpleChanges): void {
    // Vérifie si la propriété 'results' a changé et si sa valeur actuelle est définie
    if (changes['results'] && changes['results'].currentValue) {
      // Met à jour les composants avec la nouvelle valeur de 'results'
      this.updateComponentsWithResults(changes['results'].currentValue);
    } 
  }

  // ===== METHODES INDICATEURS =====

/**
 * Cette méthode remplit le tableau `indicators` avec les données des indicateurs récupérées depuis la simulation en cours.
 * 
 * Étapes principales :
 * 1. Vérifie son type pour ajuster la variable `Module10` (qui sera utilisée pour déterminer 
 *    si indicateur est 1/10 du module).
 * 2. Crée des infobulles (tooltips) pour donner des informations détaillées sur les variations de débits
 *    projetés par rapport aux débits observés.
 * 3. Ajoute chaque indicateur formaté dans la liste `indicators` qui sera ensuite affichée dans l'interface utilisateur.
 * 4. Enfin, elle appelle les méthodes `showPlot()` pour afficher le graphique mis à jour et 
 *    `updateIndicatorShapes()` pour mettre à jour les représentations visuelles des indicateurs.
 */
  fillIndicators() {//ajouter les indicateurs de la base de données au tableau du front
    this.indicators = [];  // Réinitialise le tableau des indicateurs et certaines valeurs liées à l'affichage
    this.IDIndicators = 0; // Réinitialise l'ID des indicateurs à 0
    this.tooltipTextsEstimationValue = []  // Réinitialise les infobulles
    // Parcourt chaque indicateur de la simulation actuelle (depuis `this.results.indicators`)
    this.results.indicators.forEach((indicator: { id : string, type: string; value : number; results: any; color :string})=> {
      // `Module10` est une variable booléenne qui indique si l'indicateur est du type "1/10 du module"
      let Module10 = indicator.type === "1/10 du module";  
    
      if(Module10){
        let Q50Value = indicator.results.proj_values.Q50; // Récupère la valeur projetée médiane (Q50)
        Q50Value = parseFloat(Q50Value.toFixed(2)); // Formate cette valeur avec 2 décimales
	      let Q50evolution = indicator.results.proj_ev; 
        const firstDate = this.results.results.data.first_date; // Récupère les dates de début et de fin de la simulation
        const lastDate = this.results.results.data.last_date || '';  // Si `last_date` est null, utilise une chaîne vide
        // Crée un texte pour l'infobulle expliquant la variation projetée
        const tooltipText = `Débit projeté médian en m³/s au ${lastDate}.\n 
        Cela correspond à une variation de ${Q50evolution}% par rapport au débit observé le ${firstDate}`; 
        this.tooltipTextsEstimationValue.push(tooltipText); // Ajoute le texte à la liste des infobulles
      }
      // Ajoute indicateur au tableau `indicators`
      this.indicators.push({
        id: indicator.id,
        type: indicator.type,
        value: indicator.value,
        color: indicator.color,
        fixed: Module10,
        modified:false,
      });
    });
    this.showPlot(); // Affiche les graphiques liés aux indicateurs
    this.updateIndicatorShapes(); // Met à jour les formes visuelles (formes graphiques) des indicateurs
  }

  /**
  * Méthode appelée lorsqu'un utilisateur clique sur le bouton "+" pour ajouter un nouvel indicateur.
  * 
  * Étapes principales :
  * 1. Incrémente l'identifiant de l'indicateur (`IDIndicators`).
  * 2. Crée un nouvel indicateur vide avec des valeurs par défaut et une couleur rouge.
  * 3. Marque cet indicateur comme étant modifié (`modified: true`), 
  *    ce qui indique qu'il doit être synchronisé avec le backend.
  */
  addIndicator() {
    // Incrémente l'identifiant des indicateurs pour garantir des IDs uniques
    this.IDIndicators = this.IDIndicators + 1 ;
    // Ajoute un nouvel indicateur avec des valeurs par défaut
    this.indicators.push({
      id:string(this.IDIndicators), // Convertit l'ID en chaîne pour l'attribut `id`
      type: "", // L'indicateur est ajouté avec un type vide (il s'agit du nom )
      value: 0, // Valeur initiale de l'indicateur
      color: "#Ff0000",  // couleur par défaut si non spécifié
      fixed: false, // L'indicateur n'est pas "fixe"
      modified:true // Cet indicateur est marqué comme modifié
    })
  }

/**
 * Méthode pour supprime un indicateur de la liste `indicators` et de la vue graphique et appel  l'API(api2.py) pour supprimer cet indicateur dans le backend.
 * 
 * @param index - L'index dans le tableau `indicators` où se trouve l'indicateur à supprimer.
 * @param type - Le type de l'indicateur à supprimer, utilisé dans la requête backend.
 * @returns La liste des indicateurs mise à jour après suppression.
 * 
 * Etapes principales:
 * 1. Supprime l'indicateur du tableau indicators et la forme graphique associée.
 * 2. Envoie une requête pour supprimer l'indicateur du backend via l'API.
 * 3. Met à jour la liste des indicateurs et les formes graphiques après la suppression.
 */
  removeIndicator(index: number, type: string) {
    this.indicators.splice(index, 1);// Supprime l'indicateur de la liste `indicators` à l'index donné
    this.layout?.shapes!.splice(index, 1);// Supprime l'indicateur (shape) associée dans `layout.shapes`
    // Envoie une requête au backend pour supprimer l'indicateur dans la base de données
    this.jsonService.removeIndicator(this.simulation_id!, type).then(updatedIndicators => {
      // Met à jour la liste des indicateurs avec ceux retournés par le backend après suppression
      this.results.indicators = updatedIndicators; 
      // Met à jour les formes graphiques pour refléter la suppression de l'indicateur
      this.updateIndicatorShapes();
    }).catch(error => {
      // Logge toute erreur rencontrée lors de la suppression
        console.error("Erreur lors de la suppression de l'indicateur:", error);
    });
    return this.indicators;// Retourne la liste mise à jour des indicateurs
  }

/**
 * Méthode appelée lorsque l'utilisateur modifie le type (texte) d'un indicateur.
 * 
 * @param text - Le nouveau type de l'indicateur.
 * @param index - L'index de l'indicateur à modifier dans la liste `indicators`.
 * @returns L'indicateur modifié.
 * 
 * Etapes principales :
 * 1. Met à jour le type de l'indicateur dans la liste `indicators`.
 * 2. Marque cet indicateur comme modifié pour synchronisation future avec le backend.
 * 3. Appelle updateIndicatorShapes() pour ajuster les formes graphiques.
 * 4. retourne l'indicateur modifié
 */
  onIndicatorTextChange(text : string, index : number){
    this.indicators[index].type = text ?text:""; // Modifie le type de l'indicateur à l'index donné avec le texte fourni
    this.indicators[index].modified = true; // Marque l'indicateur comme modifié
    this.updateIndicatorShapes(); // Met à jour les formes graphiques (shapes)
    return this.indicators[index] // Retourne l'indicateur modifié
  }

  /**
  * Méthode appelée lorsque l'utilisateur modifie la valeur d'un indicateur.
  * Elle met à jour la valeur dans le tableau `indicators` et dans la vue graphique.
  * 
  * @param value - La nouvelle valeur de l'indicateur.
  * @param index - L'index de l'indicateur à modifier dans la liste `indicators`.
  * @returns L'indicateur modifié avec sa nouvelle valeur.
  * 
  * Etapes principales :
  * 1. Met à jour la value de l'indicateur dans la liste `indicators`.
  * 2. Marque cet indicateur comme modifié pour synchronisation future avec le backend.
  * 3. Appelle updateIndicatorShapes() pour ajuster les formes graphiques.
  * 4. retourne l'indicateur modifié
  */
  onIndicatorValueChange(value: number, index: number) {
    //changer la valeur de l'indicateur concerné
    this.indicators[index].value = value ?value:0; // Modifie la valeur de l'indicateur à l'index donné avec la nouvelle valeur
    this.indicators[index].modified = true; // Marque l'indicateur comme modifié
    this.updateIndicatorShapes(); // Met à jour les formes graphiques (shapes)
    return this.indicators[index] // Retourne l'indicateur modifié
  }

  /**
  * Change la couleur de l'indicateur à un index donné. Cette couleur sera également 
  * reflétée dans les graphiques sous forme de ligne colorée.
  * 
  * @param color - La nouvelle couleur de l'indicateur (au format hexadécimal, par exemple "#FF0000").
  * @param index - L'index de l'indicateur à modifier dans la liste `indicators`.
  * @returns L'indicateur modifié avec sa nouvelle couleur.
  * 
  * Etapes principales:
  * 1. Met à jour la color de l'indicateur dans la liste `indicators`.
  * 2. Marque cet indicateur comme modifié pour synchronisation future avec le backend.
  * 3. Appelle updateIndicatorShapes() pour ajuster les formes graphiques.
  * 4. retourne l'indicateur modifié
  */
  updateColorStyle(color : string ,index : number){
    this.indicators[index].color = color; // Modifie la couleur de l'indicateur à l'index donné avec la nouvelle couleur
    this.indicators[index].modified = true; // Marque l'indicateur comme modifié
    this.updateIndicatorShapes(); // Met à jour les formes graphiques (shapes)
    return this.indicators[index];// Retourne l'indicateur modifié
  }

  /**
  * Met à jour toutes les formes graphiques associées aux indicateurs dans le graphique principal.
  * Pour chaque indicateur, une ligne horizontale colorée est créée, et l'axe Y est mis à jour.
  * 
  * Etapes principales :
  * 1. Filtre les anciennes formes pour ne conserver que celles associées à la "date de simulation".
  * 2. Crée une nouvelle ligne (forme) pour chaque indicateur, avec la bonne position et couleur.
  * 3. Met à jour l’axe Y pour inclure les valeurs des indicateurs, puis réajuste le graphique via Plotly.
  */
  updateIndicatorShapes() {
    // Vérifie si le graphique "previsions" est présent et si `layout` est disponible
    if(document.getElementById('previsions') && this.layout){
      // Filtre les formes pour ne conserver que celle associée à la "date de simulation"
      this.layout!.shapes = this.layout!.shapes?.filter(shape => shape.name === 'date de simulation') || [];

      // Parcourt chaque indicateur et crée une ligne horizontale pour chacun
      this.indicators.forEach(indicator => {    
        this.layout!.shapes!.push({
          type: 'line', // Chaque indicateur est représenté par une ligne
          showlegend: true, // Légende visible
          name: indicator.type, // Nom du type d'indicateur
          x0: this.simulationStartDate, // Début de la ligne à la date de début de simulation
          x1: this.simulationEndDate, // Fin de la ligne à la date de fin de simulation
          y0: indicator.value, // Position verticale de la ligne (valeur de l'indicateur)
          y1: indicator.value, // Valeur constante sur toute la longueur
          line: {color: indicator.color, width: 2, dash: 'solid'}, // Couleur et style de la ligne
          xref: 'x', // Référence à l'axe X (dates)
          yref: 'y'// Référence à l'axe Y (valeurs)
        });
      });
      
      // Met à jour l'axe Y pour s'assurer qu'il inclut toutes les valeurs des indicateurs
      this.updateAxisY();
      // Ajuste la plage de l'axe Y à la nouvelle plage calculée
      this.layout!.yaxis!.range = this.range; 
  
       // Met à jour le graphique avec les nouvelles formes et la nouvelle plage de l'axe Y
      Plotly.relayout('previsions', { shapes: this.layout!.shapes, yaxis : this.layout!.yaxis});
    }
  }

/**
 * Cette méthode synchronise les indicateurs modifiés avec le backend.
 * Elle parcourt tous les indicateurs, et pour chaque indicateur marqué comme "modifié",
 * elle envoie une requête à l'API pour mettre à jour ses données dans la base de données.
 * 
 * Etapes principales:
 * 1. Parcourt les indicateurs et détecte ceux qui ont été modifiés.
 * 2. Pour chaque indicateur modifié, envoie une requête au backend pour mettre à jour ses valeurs.
 * 3. Une fois mis à jour, marque l'indicateur comme non modifié (modified: false).
 */
  async updateResults() {
    // Vérifie si l'ID de la dernière simulation est stocké dans `sessionStorage`
    if (sessionStorage.getItem('lastSimulationId')) {
      // Crée un tableau de promesses pour mettre à jour chaque indicateur modifié
      const updatePromises = this.indicators.map(async (modifIndi) => {
        // Si l'indicateur a été modifié
        if (modifIndi.modified === true) {
          // Envoie une requête au backend pour mettre à jour les indicateurs correspondants
          const updatedIndicators = await this.jsonService.updateIndicatorsValue(sessionStorage.getItem('lastSimulationId')!,this.indicators.filter(indicator => indicator.id === modifIndi.id));
          // Met à jour la liste des indicateurs retournés par le backend
          this.results.indicators = updatedIndicators;
          // Marque l'indicateur comme non modifié après mise à jour
          modifIndi.modified = false;
        }
      });
      // Attend que toutes les promesses soient résolues avant de continuer
      await Promise.all(updatePromises);
    }
  }

  // ===== METHODES GRAPHIQUE MODELE PREVISION =====
  
  /**
  * Méthode appelée lors du changement d'état d'un toggle (interrupteur graphique)
  * Met à jour les composants graphiques en fonction des résultats actuels stockés dans `this.results`.
  * Cette méthode est typiquement déclenchée par l'utilisateur interagissant avec l'interface graphique
  * pour basculer entre différents états ou filtres.
  */
  onToggleChange() {
    // Appelle une méthode interne pour rafraîchir les composants de l'interface avec les résultats actuels.
    this.updateComponentsWithResults(this.results);
  }

/**
 * Génère une série de dates en abscisse pour les traces du graphique, à partir de deux dates données.
 * L'objectif est d'éviter de stocker toutes les dates manuellement, et de calculer dynamiquement
 * les intervalles de dates nécessaires pour la période donnée.
 * @param startDate La date de début sous forme de chaîne (format attendu : 'YYYY-MM-DD')
 * @param endDate La date de fin sous forme de chaîne (format attendu : 'YYYY-MM-DD')
 * @returns Un tableau d'objets `Date` représentant chaque jour entre la date de début et la date de fin.
 */
  generateDateSeries(startDate: string, endDate: string): Date[] {
    let dates = [];// Initialisation d'un tableau vide pour stocker les objets Date.
    let currentDate = new Date(startDate); // Conversion de la chaîne `startDate` en objet `Date`.
    // Boucle pour générer toutes les dates entre `startDate` et `endDate`. On continue tant que `currentDate` n'a pas dépassé `endDate`.
    while (currentDate <= new Date(endDate)) {
      // Ajoute une copie de l'objet `Date` dans le tableau `dates`, en s'assurant que l'heure est
      // supprimée (grâce à `toISOString().split('T')[0]`), ce qui garde uniquement la partie 'YYYY-MM-DD'.
      dates.push(new Date(currentDate.toISOString().split('T')[0])); 
      // Incrémentation de la date courante d'une journée. Méthode `setDate()` pour ajuster la date.
      currentDate.setDate(currentDate.getDate() + 1); 
    }
    return dates; // Retourne le tableau contenant toutes les dates générées.
  }

  

  /**
  * Gestion des données et organisation des traces du graphique
  * 
  * Étapes principales :
  * 1. Vérification de l'existence des données graphiques dans les résultats de la simulation.
  * 2. Génération des séries de dates pour les observations et les prédictions (axes X).
  * 3. Initialisation des accumulateurs pour les différentes séries de données (Q10, Q90, Q50, projections, observations).
  * 4. Boucle sur chaque ligne de données :
  *    - Identification et traitement des séries spécifiques (Q10, Q90, Q50, observations, projections).
  *    - Gestion des valeurs prédictives et des dates limites.
  *    - Gestion des zones d'incertitude (Q10/Q90).
  * 5. Ajout des traces au graphique dans l'ordre (projections, incertitudes, médiane, observations).
  */
  updateGraphData(): void {
     // Vérifie si les résultats de la simulation existent et contiennent des données graphiques
    if (this.showResults && this.results.results.data.graph) {
      //Générer les séries de dates pour les observations et les prédictions à partir des dates de début et de fin fournies
      this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date);
      this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date); 
      // mettre à jour la date de début simulation
      this.startDate = new Date(this.results.results.similarity.user_similarity_period[0]);
      // Initialiser les accumulateurs pour stocker les différentes séries de données nécessaires au graphique
      this.traces= []; // contient les traces du graphique
      var q10Data: { x: Date[], y: number[] } | null = null; // Accumulateur pour q10 -> Dates et valeurs
      var q90Data: { x: Date[], y: number[] } | null = null; // Accululateur pour q90 -> Dates et valeurs
      let incertitudeX; // Accumulateur pour q10 et q90 (incertitude) -> Dates
      let incertitudeY; // Accumulateur pour q19 et q90 (incertitude) -> valeurs
      let q50X ;// Accumulateur pour q50 -> Dates 
      let q50Y ; // Accumulateir pour q80 -> valeurs
      var projectionData: { x: Date[], y: number[] } = { x: [], y: [] }; // Accumulateur pour les projections -> Dates et valeurs
      let projectionDataReverse = true; // variable pour alterner l'ordre de rentrer des projections
      let observationsX ; // Accumulateur pour l'observation -> Dates
      let observationsY ; // Accumulateur pour l'observation -> valeurs
   
      // Parcourir chaque ligne de données dans le tableau de graph pour traiter les différentes séries
      this.results.results.data.graph.forEach((line: { y: any[]; name: string; mode: string; line: any;}) => {
        // Si la ligne contient des données (y non vide)
        if ( line.y ) {
          var parsedDates = this.XaxisPredictions;
          // Mettre à jour la date de fin si elle n'est pas définie ou si les prédictions actuelles sont plus récentes
          if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
            this.endDate = parsedDates[parsedDates.length - 1];
          }
          // Si la ligne contient des données de prédictions (hors observations)
          if (line.name != 'observations'){
            // Parcourir toutes les dates des prédictions
            for (let i = 0; i < parsedDates.length; i++) {
              // Si la date actuelle est comprise entre la date de début de simulation et la date de fin
              if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                // Ajouter la valeur à la liste des valeurs maximales des prédictions
                this.maxPredictedValue.push(line.y[i]);
              }
            }
          }
          // Gestion des données Q10 (incertitude basse)
          if(line.name == 'Q10'){
            // Stocker les données Q10 avec les dates des prédictions
            q10Data = { x: this.XaxisPredictions, y: line.y };
            incertitudeX = parsedDates; // Stocker les dates pour la zone d'incertitude

          // Gestion des données Q90 (incertitude haute)
          }else if ( line.name == 'Q90'){
            // Si les prédictions sont non vides, mettre à jour les dates de début et de fin de la simulation
            if (parsedDates.length > 0) {
              this.simulationStartDate = parsedDates[0];// Première date des prédictions
              this.simulationEndDate = parsedDates[parsedDates.length-1];  // Dernière date des prédictions
            }
            // Redéfinit la date de début de simulation   
            this.simulationStartDate = parsedDates[0];
            // Stocker les données Q90
            q90Data = { x: parsedDates, y: line.y };

          // Gestion des données Q50 (médiane)  
          }else if ( line.name == 'Q50'){
            // Stocker les dates et les valeurs pour la médiane (Q50)
            q50X = this.XaxisPredictions;
            q50Y = line.y;

          // Gestion des données d'observation
          }else if (line.name == 'observations'){
            // Stocker les dates et les valeurs pour les observations
            observationsX = this.XaxisObservations; 
            observationsY = line.y; 
            // Vérification de la cohérence des dates d'observation avec la simulation 
            //pour gérer si la deniere date observations et la première date de simulation sont éloigné (plusieurs année)
            //CAS RARE
            let lengthX = observationsX.length; // Longueur des dates d'observation
            let lengthY = observationsY.length; // Longueur des valeurs d'observation

            // Convertir les dates d'observation en timestamps pour trouver la date maximale
            let maxDateTimestamp = Math.max(...observationsX.map(date => new Date(date).getTime()));

            // Si la date de début de la simulation est définie
            if (this.simulationStartDate) {
              // Convertir la date de début de simulation en timestamp
              let simulationStartDateTimestamp = new Date(this.simulationStartDate).getTime(); 

              // Si la date maximale des observations est inférieure à la date de début de la simulation
              if (maxDateTimestamp < simulationStartDateTimestamp) {
                // Parcourir toutes les dates d'observation
                for (let i = 0; i < lengthX; i++) {
                  // Si une date d'observation est plus récente que la date de début de simulation
                  if (new Date(observationsX[i]).getTime() >= simulationStartDateTimestamp) {
                    // Remplacer les valeurs correspondantes par null
                    observationsY[i] = null;
                  }
                }
              }
            }
            // Si le nombre de valeurs d'observation est inférieur au nombre de dates
            if (lengthY < lengthX) {
              for (let i = lengthY; i < lengthX; i++) {
                // Ajouter des valeurs null au début pour correspondre aux dates supplémentaires
                observationsY.unshift(null); 
              }
            }

          // Gestion des données de projection  
          }else if (line.name.includes('Projection')){
            // Regroupe les données de projection dans un tableau pour une suppression en un clic sans doublon dans la légende.
            // Les données sont alternées entre l'ordre normal et inversé pour éviter des lignes traversantes dans le graphique .
            if(projectionDataReverse){// met en normal les données
              projectionData.x = projectionData.x.concat(this.XaxisPredictions);
              projectionData.y = projectionData.y.concat(line.y);
            }else{//met en reverse les données
              projectionData.x = projectionData.x.concat([...this.XaxisPredictions].reverse());
              projectionData.y = projectionData.y.concat([...line.y].reverse());
            }      
            projectionDataReverse = !projectionDataReverse; // Alterner l'ordre pour la prochaine projection
          }
          
           // Si les données Q10 et Q90 sont disponibles, créer la zone d'incertitude
          if (q10Data && q90Data) {
            // Combiner les dates et valeurs de Q10 et Q90 pour former la zone d'incertitude
            incertitudeX = q10Data.x.concat(q90Data.x.slice().reverse());
            incertitudeY = q10Data.y.concat(q90Data.y.slice().reverse());
            // Mettre à jour la date de fin avec la dernière date des données Q90
            this.endDate = (q90Data as any).x[(q90Data as any).x.length-1]
          }
        }
      });

      //Organisation des traces dans le bon ordre pour l'affichage (ordre de superposition)

      // Si les données de projection sont disponibles, créer la trace correspondante
      if (projectionData.x.length > 0 && projectionData.y.length > 0) {
        // mise en forme et rentrer dans this.traces
        var projectionTrace: Plotly.Data = {
          x: projectionData.x,
          y: projectionData.y,
          showlegend: true,
          hoverinfo: 'skip',
          mode: 'lines',
          type: 'scatter',
          name: 'événements individuels', 
          line: { color: '#b783b2', width: 1, dash: 'dot' },
        };
        this.traces.push(projectionTrace); // Ajouter la trace de projection
      }
      
      // Si les données Q10 et Q90 sont disponibles, créer la trace d'incertitude
      if (q10Data && q90Data){
        // mise en forme et rentrer dans this.traces
        var incertitudeTrace: Plotly.Data = {
          x: incertitudeX,
          y: incertitudeY,
          mode: 'lines',
          type: 'scatter',
          name: "zone d'incertitude",
          showlegend : true,
          hoverinfo : 'none',
          fill: 'toself', 
          fillcolor : 'rgba(31, 120, 180, 0.2)',
          line: { color: '#1f78b4', width: 1 }, 
        };
        this.traces.push(incertitudeTrace); // Ajouter la trace d'incertitude
      }

      // Si les données Q50 sont disponibles, créer la trace médiane
      if(q50X && q50Y){
        // mise en forme et rentrer dans this.traces
        var q50Trace : Plotly.Data = {
          x : q50X,
          y : q50Y,
          mode: 'lines',
          type: 'scatter',
          name: 'projection médiane',
          hovertemplate: 'projection médiane: %{y:.3f} m³/s<extra></extra>',
          showlegend : true,
          line: { color: '#1f78b4', width: 2 , dash: 'dot' }, 
        };
        this.traces.push(q50Trace); // Ajouter la trace de la médiane
      }

       // Si les données d'observation sont disponibles, créer la trace d'observation
      if(observationsX && observationsY){
        // mise en forme et rentrer dans this.traces
        var observationsTrace : Plotly.Data = {
          x : observationsX,
          y : observationsY,
          mode: 'lines',
          type: 'scatter',
          name: 'observation',
          showlegend : true,
          hovertemplate: 'observation: %{y:.3f} m³/s<extra></extra>',
          line: { color: 'black', width: 1 }, 
        };
        this.traces.push(observationsTrace); // Ajouter la trace des observations
      }
    }
  }

  /**
  * Calcul les valeurs Y minimales et maximales (yMin et yMax) du graphique
  * en fonction des données des observations, des prédictions et des indicateurs.
  * 
  * Étapes principales :
  * 1. Extraire les valeurs des indicateurs et calculer leurs minimum et maximum.
  * 2. Parcourir les données des observations et des prédictions pour extraire les valeurs pertinentes.
  * 3. Calculer les valeurs maximales et minimales des observations et des prédictions.
  * 4. Déterminer les valeurs yMin et yMax globales en tenant compte à la fois des indicateurs, des observations, et des prédictions.
  */
  updateYMinMax(){
    //Calculer les min/max des indicateurs 
    //Variable pour contenir les valeurs des indicateurs
    let indicatorValues: number[]= [];
     // Parcours de chaque indicateur pour extraire sa valeur
    this.indicators.forEach(indicator => {
      indicatorValues.push(indicator.value); // Ajout de la valeur de chaque indicateur à la liste
    })
    
    // Calcul des valeurs minimales et maximales dans les indicateurs
    const yMinindicator = Math.min(...indicatorValues); // Valeur minimale parmi les indicateurs
    const yMaxindicator = Math.max(...indicatorValues); // Valeur maximale parmi les indicateurs

    //Calculer les min/max des observations et des prédictions 
    //Tableau pour stocker les valeurs Y (observations et prédictions) pendant la période observée
    let yValuesWithinObservedPeriod: number[] = [];
    // Parcourir les lignes de données dans le tableau de données graphiques (observations et prédictions) 
    this.results.results.data.graph.forEach((line: { y: number[]; name: string; }) => {
      // Si la ligne contient des valeurs Y (observations ou prédictions)
      if ( line.y ) {
        // Récupérer les dates des prédictions et des observations 
        var parsedDates = this.XaxisPredictions; // variable contenant les date des prédictions 
        var parsedDatesObservations = this.XaxisObservations; // Variable contenant les date des observations

        // Si la dernière date des prédictions n'est pas encore définie ou qu'elle est plus récente que la date de fin actuelle
        if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
          this.endDate = parsedDates[parsedDates.length - 1]; // Mise à jour de la date de fin avec la dernière date de prédiction
        }

        // Gestion des données de prédictions
        if (line.name != 'observations'){
          // Parcours des dates dans la série de prédictions
          for (let i = 0; i < parsedDates.length; i++) {
            // Si la date de prédiction est dans la plage de la période observée
            if (parsedDates[i] >= this.startDate && parsedDates[i] <= this.endDate) {
              yValuesWithinObservedPeriod.push(line.y[i]);// Ajouter la valeur Y à la liste
            }
            // Si la date de prédiction est dans la plage de la simulation
            if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
              this.maxPredictedValue.push(line.y[i]);  // Ajouter la valeur à la liste des valeurs maximales prédiction
            }
          }

        //Gestion des données d'observations  
        }else{
          // Parcours des dates dans la série d'observations
          for (let i = 0; i < parsedDatesObservations.length; i++) {
            // Si la date d'observation est dans la plage de la période observée
            if (parsedDatesObservations[i] >= this.startDate && parsedDatesObservations[i] <= this.endDate) {
              yValuesWithinObservedPeriod.push(line.y[i]);// Ajouter la valeur Y à la liste
            }
          }
        }

        //Calculer les valeurs min/max des observations et prédictions
        const yMingraph = Math.min(...yValuesWithinObservedPeriod); // Minimum des valeurs observées/predictées
        const yMaxgraph = Math.max(...yValuesWithinObservedPeriod);  // Maximal des valeurs observées/predictées


        //Calculer les yMin et yMax globaux
        // Déterminer le minimum global (en prenant le minimum entre les données du observées/predictées et les indicateurs) 
        this.yMin = Math.min(yMingraph,yMinindicator);
         // Déterminer le maximum global (en prenant le maximum entre les données du observées/predictées et les indicateurs)
        this.yMax = Math.max(yMaxgraph,yMaxindicator);
      }
    });
  }

  /**
  * Met à jour l'axe Y du graphique en fonction des valeurs YMax et YMin calculées.
  * Si le mode logarithmique est activé (this.on = true), l'axe Y est ajusté en échelle logarithmique.
  * 
  * Étapes principales :
  * 1. Mettre à jour les valeurs YMin et YMax en fonction des observations, prédictions et indicateurs.
  * 2. Appliquer un ajustement pour éviter que les lignes du graphique ne soient trop proches des bords du graphique.
  * 3. Choisir l'échelle (linéaire ou logarithmique) en fonction de l'état de la variable `this.on`.
  * 4. Calculer les valeurs finales à appliquer à l'axe Y, en tenant compte de l'échelle sélectionnée.
  * 5. Gérer le cas où l'inversion de l'axe se produirait (éviter que YMin soit supérieur à YMax).
  */
  updateAxisY(){

    // Appel à la fonction updateYMinMax pour mettre à jour les variables this.yMin et this.yMax
    // Ces valeurs sont déterminées en fonction des données des observations, prédictions et indicateurs.
    this.updateYMinMax();
    
    //Pour éviter que les lignes du graphique ne soient collées aux bords, on applique un ajustement de 10%
    const percentage = 0.10;
    // Ajustement de la valeur minimale Y en réduisant légèrement sa valeur
    const adjustedYMin = this.yMin * (1 - percentage);
    // Ajustement de la valeur maximale Y en augmentant légèrement sa valeur
    const adjustedYMax = this.yMax * (1 - percentage);

    // Si `this.on` est vrai, l'échelle est linéaire ('linear'), sinon elle est logarithmique ('log')
    this.type = this.on ? 'linear' : 'log';
    
    // Si le mode log est désactivé (this.on = false), on applique la transformation logarithmique avec Math.log10.
    // Sinon, on garde les valeurs ajustées directement
    const yMin = this.on ? adjustedYMin : Math.log10(adjustedYMin);
    const yMax = this.on ? adjustedYMax : Math.log10(adjustedYMax);
    
    // Si, pour une raison quelconque, YMin se retrouve supérieur à YMax, on inverse les valeurs pour éviter une erreur.
    // Cela permet de s'assurer que l'axe est correctement ordonné.
    this.range = yMin > yMax ? [yMax, yMin] : [yMin, yMax];
    
  }

  /**
  * Met en place le layout (mise en page) du graphique, incluant la légende, les axes Y/X, et la forme (shape) pour la simulation.
  * 
  * Étapes principales :
  * 1. Mettre à jour l'axe Y (yMax, yMin) en fonction des données et déterminer l'échelle (logarithmique ou linéaire).
  * 2. Configurer le layout du graphique, y compris les titres, la légende, les axes X et Y, et la forme représentant la simulation.
  * 3. Appliquer des paramètres esthétiques comme la couleur de fond, les marges, et la gestion automatique de la taille.
  */
  updateLayout() { 
    // Appel à la fonction updateAxisY pour recalculer et ajuster les limites de l'axe Y 
    // Cela prend en compte les prédictions, observations et indicateurs
    this.updateAxisY();

    // Définition du layout (mise en page) principal du graphique
    this.layout = {
      hovermode: "x unified", // bulle d'information activé
      title: {
        text: this.watershedID + " | " + this.stationName, // Le titre affiche l'ID du bassin versant et le nom de la station
        font: { size: 20,  family: 'Segoe UI Semibold'}, // Style du texte du titre
      },
      //paramètre de la légende 
      legend: {
        orientation: 'h', // Légende en orientation horizontale
        font: { size: 16, color: '#333', family: 'Segoe UI, sans-serif'},  // Style de la police de la légende
        x: 0.5, // Positionnement horizontal 
        xanchor: 'center', // Ancre sur le centre horizontal
        y: 1.1, // Positionnement vertical 
        yanchor: 'top', // Ancre sur le haut vertical
      },
      //paramètre de axe X
      xaxis: {
        title: '', // Pas de titre pour l'axe X
        showgrid: true, // Afficher une grille 
        gridcolor: 'rgba(200, 200, 200, 0.3)', // Couleur semi-transparente de la grille
        zeroline: false, // Ne pas afficher la ligne zéro sur l'axe X
        tickformat: '%d-%m-%Y', // Format des ticks (valeurs) de l'axe X en jours/mois/année
        tickmode: 'auto' as 'auto', // Mode de génération automatique des ticks
        tickangle: 0, // Pas d'angle sur les ticks (horizontal)
        ticks: 'inside', // Les ticks sont affichés à l'intérieur du graphique
        tickfont: { size: 16, family: 'Segoe UI Semibold'}, // Style de la police des ticks
        nticks: 10,  // Nombre maximal de ticks à afficher
        range: [this.startDate, this.endDate], // Intervalle de l'axe X basé sur les dates de début et de fin
        hoverformat: '%d %b %Y', // Format de l'affichage des dates lors du survol
      },
      //paramètre de axe Y
      yaxis: {
        title: 'Débit [m³/s]', // Titre de l'axe Y
        titlefont: {size: 16, family: 'Segoe UI Semibold'}, // Style du titre de l'axe Y
        tickfont: {size: 16, family: 'Segoe UI Semibold'}, // Style des ticks de l'axe Y
        showline: false, // Ne pas afficher de ligne continue le long de l'axe Y
        ticks: 'inside', // Les ticks sont affichés à l'intérieur du graphique
        type: this.type as AxisType, // Type d'échelle : linéaire ou logarithmique en fonction de `this.type`
        range: this.range // Intervalle des valeurs de l'axe Y, défini dans updateAxisY()
      },
    
      // Paramètre de la ligne indiquant la date de simulation 
      // Affiche une ligne verticale à la date de début de la simulation si les dates sont définies
      shapes: this.simulationStartDate && this.simulationEndDate ? [{
        type: 'line', // Type de forme (ici, une ligne)
        name: 'date de simulation', // Nom de la ligne
        x0: this.simulationStartDate, // Point de départ (coordonnée X) de la ligne
        x1: this.simulationStartDate, // Point de fin (coordonnée X) de la ligne(même que x0 pour une ligne verticale)
        y0: 0.001, // Coordonnée Y de départ (proche de zéro mais évitant le 0 exact)
        y1: this.yMax, // Coordonnée Y de fin (atteint le maximum de l'axe Y)
        line: {color: 'gray', width: 2, dash: 'dot'} // Style de la ligne
      }] : [],

      // Ajout des couleurs de fond transparentes
      paper_bgcolor: 'rgba(0, 0, 0, 0)', // Fond global transparent
      plot_bgcolor: 'rgba(0, 0, 0, 0)',  // Fond de la zone de traçage transparent
      margin: {l: 50,  r: 30 },// Espace à gauche pour les labels Y et espace à droite pour ne pas couper les courbes
      autosize: true,  // Le graphique s'adapte automatiquement à la taille du conteneur
    };
  }

  /**
  * Affiche le graphique à l'aide de Plotly.
  * 
  * 
  * Etapes principales:
  * 1. Gère la conversion des données JSON en cas de chaîne de caractères et corrige les valeurs non valides (NaN, Infinity).
  * 2. Mis en place graphique avec Plotly.
  * 3. Ajoute également une annotation indiquant la date de simulation.
  */
  showPlot() {
    // gere si this.results.results.data est une chaine String 
    if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
      try {
         // Nettoyage des valeurs non valides dans la chaîne JSON (remplacement des NaN et Infinis)
        let cleanedData = this.results.results.data
        .replace(/NaN/g, 'null')
        .replace(/Infinity/g, 'null')
        .replace(/-Infinity/g, 'null');
        // Conversion de la chaîne nettoyée en objet JSON
        this.results.results.data = JSON.parse(cleanedData);
    } catch (e) {
        console.error('La conversion de la chaîne en objet a échoué :', e);
      }
    }

  // Si l'élément avec l'ID 'previsions' existe dans le DOM
  if(document.getElementById('previsions')){
      // Génère le graphique avec Plotly en utilisant les traces et la disposition
      Plotly.newPlot('previsions', this.traces, this.layout, { responsive: true });

       // Ajout d'une annotation spécifique sur la date de simulation
      const annotation: Partial<Plotly.Annotations> = {
        text: "Date de la simulation",
        xref: 'x', yref: 'paper',
        x:   this.simulationStartDate ? this.simulationStartDate.toISOString() : undefined, 
        y: 1,
        showarrow: false,
        font: { size: 14, family: 'Segoe UI Semibold', }
      };
       // Met à jour la disposition pour inclure l'annotation et ajuster la largeur du graphique
      Plotly.relayout('previsions', { annotations: [annotation] ,width : document.getElementById('previsions')!.clientWidth });
    }
  }  

  /**
  * Télécharge un fichier CSV contenant les données graphiques filtrées, excluant les projections.
  * Se base sur les dates de début et de fin spécifiées pour filtrer les données pertinentes.
  */
  downloadFile(): void {
    // Vérifiez si les dates de début et de fin sont définies
    if (!this.startDate || !this.endDate) {
      console.error("Start date and end date must be defined.");
      return;
    }

    const startDate = new Date(this.startDate);
    const endDate = new Date(this.endDate);

    // Filtrer les données pour exclure les lignes ayant "Projection" dans le nom
    const filteredData = this.results.results.data.graph.filter((line: { name: string }) => {
      return !line.name.includes('Projection');
    });

    // Extraction des dates uniques dans l'intervalle [startDate, endDate]
    const dates = new Set<string>();

    // Traitement des observations avec this.XaxisObservations
    this.XaxisObservations.forEach((date: Date) => {
      if (date >= startDate && date <= endDate) {
        dates.add(date.toISOString().split('T')[0]); // Convertir en chaîne de caractères formatée
      }
    });

    // Traitement des prédictions avec XaxisPredictions
    this.XaxisPredictions.forEach((date: Date) => {
      if (date >= startDate && date <= endDate) {
        dates.add(date.toISOString().split('T')[0]); // Convertir en chaîne de caractères formatée
      }
    });

    // Conversion du Set en tableau de dates uniques
    let uniqueDates = Array.from(dates);
  
    // Récupération des indices correspondant aux dates uniques pour les observations
    const observationDateIndices = this.XaxisObservations
      .map((date, index) => (uniqueDates.includes(date.toISOString().split('T')[0]) ? index : -1))
      .filter(index => index !== -1);

    // Récupération des indices correspondant aux dates uniques pour les prédictions
    const predictionDateIndices = this.XaxisPredictions
      .map((date, index) => (uniqueDates.includes(date.toISOString().split('T')[0]) ? index : -1))
      .filter(index => index !== -1);

    // Initialisation de columnData
    const columnData: { [date: string]: { [columnName: string]: any } } = {};
    uniqueDates.forEach(date => {
      columnData[date] = {
        Q90: '',
        Q50: '',
        Q10: '',
        observations: ''
      };
    });
        
    // Remplissage de columnData avec les valeurs de y
    filteredData.forEach((line: { name: string; y: any[]; }) => {
      let dateIndices;
      let columnName: string; // Déclaration explicite du type string
          
      if (line.name === 'observations') {
        dateIndices = observationDateIndices;
        columnName = 'observations';
      }else{
        dateIndices = predictionDateIndices;
        columnName = line.name; 
      }
          
      dateIndices.forEach(index => {
        const date = line.name === 'observations' ? this.XaxisObservations[index].toISOString().split('T')[0] : this.XaxisPredictions[index].toISOString().split('T')[0];
        if (columnData[date]) {
          if (line.y[index] !== undefined) { // Vérifier si la valeur de y existe pour cet index
            columnData[date][columnName] = line.y[index];
          }
        }
      });
    });

    // Construire le CSV avec en-têtes
    let csv = 'Date,Q90,Q50,Q10,observations\n';
    uniqueDates.forEach(date => {
      // Reformater la date au format souhaité (ISO 8601 : YYYY-MM-DD)
      const formattedDate = new Date(date).toISOString().split('T')[0];
      csv += `${formattedDate},${columnData[date]['Q90']},${columnData[date]['Q50']},${columnData[date]['Q10']},${columnData[date]['observations']}\n`;
    });
      
    // Créer le Blob à partir du CSV
    const blob = new Blob([csv], { type: 'text/csv' });

    // Créer l'URL du Blob
    const url = window.URL.createObjectURL(blob);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    const fileName = `prévision_${this.stationName}_[${formattedStartDate}-${formattedEndDate}].csv`;

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
    
  // ===== METHODES MATRICES===== 

  /**
 * Génère et affiche une matrice de corrélation des recharges pour plusieurs stations.
 * Utilise un graphique de type heatmap pour visualiser les corrélations entre les stations.
 */
  matriceRecharge(): void {
    if (this.stations.length > 0){
      const columns = this.results.results.similarity.corr_matrix.recharge.columns;  
      const columnNames = columns.map((columnId: any) => {
        const station = this.stations.find(station => station.index.toLowerCase() === columnId.toLowerCase());
        const name = station ? station.name : "Unknown"; // Default to "Unknown" if station is not found
        return `${columnId} - ${name}`;
      });
      
      const data = this.results.results.similarity.corr_matrix.recharge.data;
      const index = this.results.results.similarity.corr_matrix.recharge.index;

      // Remplacer les 1 par null dans le tableau de données
      const modifiedData = data.map((row: number[]) => row.map(value => value === 1 ? null : value));

      const DataMatrice: any[] = [];
      DataMatrice.push({
        z: modifiedData,
        x: columnNames,
        y: index,
        type: 'heatmap',
        colorscale: this.colorScale,
        reversescale: true,
        showscale: false,
        xgap: 1,
        ygap: 1
      });

      // Calcul de la taille de la figure en fonction de la taille souhaitée des cases
      const caseHeight = 10; // Hauteur de chaque case en pixels
      const caseWidth = 20;  // Largeur de chaque case en pixels
      const height = caseHeight * index.length; // Hauteur totale de la figure
      const width = caseWidth * columns.length; // Largeur totale de la figure

      const figLayout: Partial<Layout> = {
        title: {
          text: '<b>Recharge des nappes</b>',
          yanchor: 'bottom',  // Ancrage vertical en bas
          xanchor: 'center',  // Ancrage horizontal au centre par défaut
          x: 0.5,  // Position horizontale centrée (valeur entre 0 et 1)
          y: 0.05,
          font: {size: 25, color: 'black', family: 'Arial, sans-serif'} 
        },
        xaxis: {
          tickangle: -90,
          side: 'top',
          automargin: true,
          tickfont:{size: 14} 
        },
        yaxis: {
          tickmode: 'array',
          autorange: 'reversed'
        },
        margin: {
          t: 50,  // marge supérieure
          b: 100,  // marge inférieure pour éviter la coupe des labels
          l: 50,  // marge gauche
          r: 50   // marge droite
        },
        height: height + 200, 
        width: width + 300, 
      };
      //mettre en vertical si matrice trop grande 
      if(columns.length > 15 ){
        this.matricecolumn = true;
        const matricewidth = 0.50 * window.innerWidth;
        Plotly.newPlot('matriceRecharge', DataMatrice, figLayout);
        Plotly.relayout('matriceRecharge',{width :matricewidth});
      }else{
        this.matricecolumn = false;
        const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
        const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.30 * window.innerWidth;
        Plotly.newPlot('matriceRecharge', DataMatrice, figLayout);
        Plotly.relayout('matriceRecharge',{width :matricewidth});
      }
    }
  }

/**
 * Génère et affiche une matrice de corrélation des discharges pour plusieurs stations.
 * Utilise un graphique de type heatmap pour visualiser les corrélations entre les stations.
 */
  matriceSpecificDischarge(): void {
    if (this.stations.length > 0){
      const columns = this.results.results.similarity.corr_matrix.specific_discharge.columns; 
      const columnNames = columns.map((columnId: any) => {
        const station = this.stations.find(station => station.index.toLowerCase() === columnId.toLowerCase());
        const name = station ? station.name : "Unknown"; // Default to "Unknown" if station is not found
        return `${columnId} - ${name}`;
      });
      
      const data = this.results.results.similarity.corr_matrix.specific_discharge.data;
      const index = this.results.results.similarity.corr_matrix.specific_discharge.index;

      // Remplacer les 1 par null dans le tableau de données
      const modifiedData = data.map((row: number[]) => row.map(value => value === 1 ? null : value));

      const DataMatrice: any[] = [];
      DataMatrice.push({
        z: modifiedData,
        x: columnNames,
        y: index,
        type: 'heatmap',
        colorscale: this.colorScale,
        reversescale: true,
        showscale: false,
        xgap: 1,
        ygap: 1
      });

      // Calcul de la taille de la figure en fonction de la taille souhaitée des cases
      const caseHeight = 10; // Hauteur de chaque case en pixels
      const caseWidth = 20;  // Largeur de chaque case en pixels
      const height = caseHeight * index.length; // Hauteur totale de la figure
      const width = caseWidth * columns.length; // Largeur totale de la figure

      const figLayout: Partial<Layout> = {
        title:{
          text: '<b>Débits de cours d\'eau</b>',
          yanchor: 'bottom',  
          xanchor: 'center', 
          x: 0.5,  
          y: 0.05,
          font:{size: 25, color: 'black', family: 'Arial, sans-serif'}  
        },
        xaxis:{
          tickangle: -90,
          side: 'top',
          automargin: true,
          tickfont: {size: 14}        
        },
        yaxis:{
          tickmode: 'array',
          autorange: 'reversed'
        },
        margin:{
          t: 50,  // marge supérieure
          b: 100,  // marge inférieure pour éviter la coupe des labels
          l: 50,  // marge gauche
          r: 50   // marge droite
        },
        height: height + 200,
        width: width + 300,
      };

      if(columns.length > 15 ){
        this.matricecolumn = true;
        const matricewidth = 0.50 * window.innerWidth;
        Plotly.newPlot('matriceSpecificDischarge', DataMatrice, figLayout);
        Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
      }else{
        this.matricecolumn = false;
        const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
        const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.30 * window.innerWidth;
        Plotly.newPlot('matriceSpecificDischarge', DataMatrice, figLayout);
        Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
      }
    }
  }

/**
 * Crée une heatmap des scénarios en traitant les données de scénarios récupérées.
 * Exclut les éléments nuls ou égaux à zéro et affiche la matrice sous forme de graphique.
 */
  createScenariosHeatmap() {
    try{
      // Utiliser flat() pour aplatir la matrice en un tableau à une dimension
      const flattenedData = this.results.results.scenarios.data.flat();
      // Utiliser filter() pour garder uniquement les éléments différents de 0
      const nonZeroElements = flattenedData.filter((value: number) => value !== 0);
      // La longueur du tableau résultant est le nombre d'éléments différents de 0
      this.similarScenarios = nonZeroElements.length;  
    }catch(e){
      console.error(e)
    }
      
    // Vérifie si des stations sont disponibles
    if (this.stations.length >0){

      const stations = this.results.results.scenarios.columns;
      const labeledStations = this.createMatrixStationLabel(stations)
      const data = this.results.results.scenarios.data;
      // Transpose the data matrix because we want years in x and stations in y
      const transposedData = data[0].map((_: any, colIndex: string | number) => data.map((row: { [x: string]: any; }) => row[colIndex]));
      const index = this.results.results.scenarios.index;
      const DataMatrice: any[] = [];

      DataMatrice.push({
        z: transposedData,
        x: index,
        y: labeledStations,
        type: 'heatmap',
        colorscale: [[0, 'rgba(0, 0, 0, 0.2)'], [1, 'rgb(34, 94, 168)']],
        reversescale: false,
        showscale: false,
        xgap: 1,
        ygap: 1
      });
      
      // Calcul de la taille de la figure en fonction de la taille souhaitée des cases
      const caseHeight = 20; // Hauteur de chaque case en pixels
      const caseWidth = document.getElementById("matriceScenarios")!.clientWidth/transposedData[0].length;  // Largeur de chaque case en pixels
      //console.log(caseWidth)
      const height = caseHeight * labeledStations.length; // Hauteur totale de la figure
      const width = caseWidth * index.length; // Largeur totale de la figure
      //console.log(index.length)
      //console.log(width)
      //console.log(document.getElementById("matriceScenarios")!.clientWidth)
      
      // Calculate the width of the longest label
      const longestLabel = Math.max(...labeledStations.map((label: string | any[]) => label.length));
      const labelFontSize = this.scenariosMatrixFontSize; // Font size in pixels
      const figLayout: Partial<Layout> = {
        xaxis:{
          tickangle: -90,
          side: 'top',
          automargin: true,
          tickfont: {size: labelFontSize} 
        },
        yaxis:{
          tickfont: {size: labelFontSize},
          tickmode: 'array',
          autorange: 'reversed'
        },
        margin: {
          t: 50,  // marge supérieure
          b: 10,  // marge inférieure pour éviter la coupe des labels
          l:longestLabel * labelFontSize *0.8,  // marge gauche
          // r: 50   // marge droite
        },
        height: height + 20,
        // Ajout des couleurs de fond transparentes
        paper_bgcolor: 'rgba(0, 0, 0, 0)', // Fond global transparent
        plot_bgcolor: 'rgba(0, 0, 0, 0)',  // Fond de la zone de traçage transparent  
      };
      Plotly.newPlot('matriceScenarios', DataMatrice, figLayout);
      Plotly.relayout('matriceScenarios',{width :this.calculateMatrixWidth('matriceScenarios',stations,this.scenariosMatrixFontSize)});
    }
  }
    
  /**
  * Crée des étiquettes pour les stations à partir des identifiants fournis.
  * @param stations - Tableau des identifiants des stations
  * @returns - Tableau des étiquettes formatées pour chaque station
  */
  createMatrixStationLabel(stations: any[]){
    const labeledStations = stations.map((columnId: any) => {
      const station = this.stations.find(station => station.index.toLowerCase() === columnId.toLowerCase());
      const name = station ? station.name : "Unknown";
      return `${columnId} - ${name}`
    })
    return labeledStations
  }
  
/**
 * Calcule la largeur d'une matrice basée sur l'ID, les étiquettes et la taille de la police.
 * @param id - L'ID de l'élément DOM contenant la matrice
 * @param labels - Tableau des étiquettes à afficher
 * @param fontsize - Taille de la police utilisée pour les étiquettes
 * @returns - Largeur calculée de la matrice
 */
  calculateMatrixWidth(id:string, labels :any [], fontsize :number){
    // return (document.getElementById(id)!.clientWidth + Math.max(...labels.map((label: string | any[]) => label.length)) * fontsize)*0.95;
    // Retourne la largeur de l'élément DOM avec une marge supplémentaire pour les étiquettes
    return (document.getElementById(id)!.clientWidth);
  }

  /**
  * Gère l'affichage des matrices en fonction des choix sélectionnés dans le dropdown.
  */
  renderMatrix() {
    this.cdr.detectChanges();
    if (this.selectedMatrix === 'recharge') {
      this.matriceRecharge();
    }else if (this.selectedMatrix === 'discharge') {
      this.matriceSpecificDischarge();
    }else if (this.selectedMatrix === 'all'){
      this.matriceRecharge();
      this.matriceSpecificDischarge();
    } 
  }

// ===== METHODES AFFICHAGE GENERAL ===== 

  /**
  * Met à jour les composants du résultat (graphique, matrice, etc.) avec les nouvelles données.
  * @param results - Les résultats à utiliser pour mettre à jour les composants
  */
  private updateComponentsWithResults(results: any): void {
    // Mise à jour des résultats et de la matrice de corrélation
    this.results = results;
    this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.stationName = this.results.station_name;
    this.watershedID = this.results.watershed_id;
    
    // Mise à jour des autres éléments
    this.fillIndicators();
    this.updateGraphData();
    this.updateLayout();
    this.showPlot();
    this.updateIndicatorShapes();
    this.createScenariosHeatmap();
    if (this.showAdditionialMatrix){
      this.matriceRecharge();
      this.matriceSpecificDischarge();
    }
  }


  /**
  * Ouvre un dialogue pour la visualisation, en utilisant l'événement du clic.
  * @param event - L'événement déclenché par le clic
  */
  openDialogViz(event: MouseEvent) {
    this.dialog.open(PopupDialogViz, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false
      // Pas de paramètres de position pour permettre un centrage automatique
    });
  }


  openDialogThreshold(event: MouseEvent) {
    this.dialog.open(PopupDialogThreshold, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false,
      // Pas de paramètres de position pour permettre un centrage automatique
    });
  }

  openDialogEvents(event: MouseEvent) {
    this.dialog.open(PopupDialogEvents, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false,
      // Pas de paramètres de position pour permettre un centrage automatique
    });
  }


  // ===== METHODES SIMPLIFIER LE CODE =====       

  /**
  * Retourne les clés d'un objet JSON.
  * @param obj - L'objet dont on veut obtenir les clés
  * @returns - Un tableau de clés de l'objet
  */      
  keys(obj: any) {//fonction pour retourner les clés d'un json
    return Object.keys(obj);
  }

  /**
  * Renvoie la valeur maximale parmi deux nombres.
  * @param v1 - Le premier nombre
  * @param v2 - Le second nombre
  * @returns - La valeur maximale
  */
  max(v1: number, v2: number): number {
    return Math.max(v1, v2);
  }

  /**
  * Renvoie la valeur minimale parmi deux nombres.
  * @param v1 - Le premier nombre
  * @param v2 - Le second nombre
  * @returns - La valeur minimale
  */
  min(v1: number, v2: number): number {
    return Math.min(v1, v2);
  }

  /**
  * Convertit un volume en entier, en arrondissant à l'entier inférieur.
  * @param volume - Le volume à convertir
  * @returns - Le volume arrondi à l'entier inférieur
  */
  getVolumeAsInt(volume: number): number {
    return Math.floor(volume || 0); // Renvoie 0 si volume est nul ou non défini
  }

  /**
  * Applique un filtre sur la source de données (tableau des corrélations).
  * @param event - L'événement déclenché lors de la saisie dans le champ de filtre
  */
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;// Récupère la valeur du champ de filtre
    this.dataSource!.filter = filterValue.trim().toLowerCase(); // Applique le filtre en supprimant les espaces et en mettant en minuscules
    if (this.dataSource!.paginator) {
      this.dataSource!.paginator.firstPage();// Retourne à la première page si un paginator est présent
    }
  }
}

/**
* Composant pour afficher un dialogue de visualisation.
*/
@Component({
  selector: 'popupDialogViz',
  templateUrl: './popupDialogViz.html',
})
export class PopupDialogViz {}

@Component({
  selector: 'popupDialogThreshold',
  templateUrl: './popupDialogThreshold.html',
})
export class PopupDialogThreshold {}

/**
* Composant pour afficher les résultats de la simulation.
*/
@Component({
  selector: 'popupDialogEvents',
  templateUrl: './popupDialogEvents.html',
})
export class PopupDialogEvents {
  constructor(public dialogRef: MatDialogRef<PopupDialogEvents>) {}

  onClose(): void {
    this.dialogRef.close();
  }

}

