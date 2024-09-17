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
import { JsonService } from '../service/json.service';
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


@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss'],
})
export class SimulationResultsComponent implements OnInit, OnDestroy {
  tooltipTextsEstimationValue: string[] = [];
  stations: any[] = [];
  selectedMatrix: string = 'all';
  on: boolean = false;
  matricecolumn: boolean = false;
  range: number[] = [];
  type : any = "log";
  private resizeListener : ()=> void;

  constructor(private jsonService: JsonService, public dialog : MatDialog, private cdr: ChangeDetectorRef){
    //listener permettant de redimensionner la map et le graphe en fonction de la taille de fenêtre
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

  displayedColumns: string[] = ['Year', 'ID', 'Coeff'];
  dataSource : MatTableDataSource<any> | undefined;

  simulationStartDate: Date | undefined;
  simulationEndDate: Date | undefined;
  traces: Plotly.Data[] = [];
  layout: Partial<Plotly.Layout> | undefined;
  endDate: Date | undefined;

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;
  @ViewChild(MatSort)
  sort!: MatSort;

  // récuperation des résultats ( venant de simulateur-cydre)
  //pour appelé il faut this.results
  @Input() results: any = {
    indicators:[],
    results:{ 
      corr_matrix:"",
      data:"",
      similarity:{
        corr_matrix: {
        recharge:"",
        specific_discharge:""
      },
      selected_scenarios:"",
      similar_watersheds:"",
      user_similarity_period:""
    },
  }};

  @Input() simulation_id: string | undefined |  null = null
  @Input() showResults: boolean = false;
  @Input() watershedID: string | null | undefined;
  @Input() showAdditionialMatrix = false;

  watershedName: string | null | undefined;
  stationName: string | null | undefined;
  startDate: Date = new Date(this.results.results.similarity.user_similarity_period[0]);
  yMin = 0;
  yMax = 0;

  maxPredictedValue : number[] = [];

  XaxisObservations : Date[] = [];
  XaxisPredictions : Date[] = [];
  indicators: Array<Indicator> = [];
  IDIndicators : number = 0;
  colorScheme: Color = {
    name: 'default',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
  };
  similarScenarios : number = 0;
  scenarios : any;
  displayedColumnsScenarios  : string []= [];
  allColumns: string[] = [];
  scenariosHeatMap: any;
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

  scenariosMatrixFontSize : number = 11
  

  async ngOnInit(): Promise<void> {
    this.simulation_id = sessionStorage.getItem('lastSimulationId')?sessionStorage.getItem('lastSimulationId'):null
    await this.initGDFStations();
    try{
      if(this.results.results.data){//générer les traces du graphe
        if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
          try {
            // Nettoyer les valeurs non valides dans la chaîne JSON
            let cleanedData = this.results.results.data
            .replace(/NaN/g, 'null')
            .replace(/Infinity/g, 'null')
            .replace(/-Infinity/g, 'null');
            // Essayez de convertir la chaîne nettoyée en objet JSON
            this.results.results.data = JSON.parse(cleanedData);
        } catch (e) {
            console.error('La conversion de la chaîne en objet a échoué :', e);
          }
        }
        this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date)
        this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date)
      }else{
        console.log("Données manquantes lors de la création des traces du graphe ")
      }
    }catch(error){
      console.log("Problème lors de la création des traces du graphe : " + error)
    }

    try{
      if(this.results.results.corr_matrix){ //création de la matrice de corrélation
        if(this.results.results.data){
              // gere si this.results.results.data est une chaine String 
        if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
          try {
            // Nettoyer les valeurs non valides dans la chaîne JSON
            let cleanedData = this.results.results.data
            .replace(/NaN/g, 'null')
            .replace(/Infinity/g, 'null')
            .replace(/-Infinity/g, 'null');
            // Essayez de convertir la chaîne nettoyée en objet JSON
            this.results.results.data = JSON.parse(cleanedData);
        } catch (e) {
            console.error('La conversion de la chaîne en objet a échoué :', e);
          }
        }
      console.log(this.results.results.data);
        this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
        // this.scenarios = new MatTableDataSource(this.results.results.scenarios);
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;     
      }else{
        console.log("Données manquantes lors du chargement de la matrice de corrélation")
      }
    }}catch(error){
      console.log("Problème lors du chargement de la matrice de corrélation:"+error)
    }

    try{
      if(this.results.indicators){//création du tableau contenant les indicateurs
        this.fillIndicators();
      }else{
        console.log("Données manquantes lors du chargement des indicateurs")
      }
    }catch(error){
      console.log("Problème lors du chargement des indicateurs:"+error)
    }
    if(this.results.results.similarity){
      const columns = this.results?.results?.similarity?.corr_matrix?.specific_discharge?.columns;
      this.matricecolumn = columns && columns.length > 15;
      
    }
    try{//création des matrices de similarités
      if(this.results.results.similarity && this.showAdditionialMatrix){
        this.cdr.detectChanges();
        this.matriceRecharge();
        this.matriceSpecificDischarge();
      }else{
        console.log("Données manquantes lors du chargement des matrices de similarités")
      }
    }catch(error){
      console.log("Problème lors du chargement des matrices de similarités : " + error)
    }

    try {//Création du tableau de scenarios
      if(this.results.results.scenarios){
        this.cdr.detectChanges();
        this.createScenariosHeatmap()
        console.log("Scenarios OK")
      }else{
        console.log("Données manquantes lors du chargement du tableau de scenarios")
      }
    }catch(error){
      console.log("Problème lors du chargement du tableau scenarios : " + error)
    }
    console.log(this.results)
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(){//à la destruction du composant
    window.removeEventListener('resize', this.resizeListener);//détruire le listener
  }

  async initGDFStations() {
    await this.jsonService.getGDFStations().then(data => {
      this.stations = data;
      console.log(this.stations)
      this.cdr.detectChanges();
    });
  }
  getVolumeAsInt(volume: number): number {
    return Math.floor(volume || 0);
  }

  
  ngAfterViewInit() {
    this.updateComponentsWithResults(this.results);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results'] && changes['results'].currentValue) {
      this.updateComponentsWithResults(changes['results'].currentValue);
    } 
  }

  onToggleChange() {
    this.updateComponentsWithResults(this.results);
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource!.filter = filterValue.trim().toLowerCase();
    if (this.dataSource!.paginator) {
      this.dataSource!.paginator.firstPage();
    }
  }

  //PARTIE INDICATEURS// 

  fillIndicators() {//ajouter les indicateurs de la base de données au tableau du front
    this.indicators = [];  // Réinitialiser le tableau des indicateurs
    this.IDIndicators = 0;
    this.tooltipTextsEstimationValue = [] 
    // Supposons que `this.simulationData` contient le tableau des indicateurs
    this.results.indicators.forEach((indicator: { id : string, type: string; value : number; results: any; color :string})=> {
                // `data` est un objet avec `results`, `type`, et `value`
                let fixedValue = indicator.type === "1/10 du module";  // Déterminer si 'fixed' doit être true ou false
                if(fixedValue){
                  let Q50Value = indicator.results.proj_values.Q50;
                  console.log("proj_values", indicator)
                  Q50Value = parseFloat(Q50Value.toFixed(2));
                  const firstDate = this.results.results.data.first_date;
                  const lastDate = this.results.results.data.last_date || ''; 
                  const tooltipText = `Débit projeté médian en m³/s au ${lastDate}.\n 
                  Cela correspond à une variation de ${Q50Value}% par rapport au débit observé le ${firstDate}`; 
                  this.tooltipTextsEstimationValue.push(tooltipText);
                }
                this.indicators.push({
                    id: indicator.id,
                    type: indicator.type,
                    value: indicator.value,
                    color: indicator.color,
                    fixed: fixedValue,
                    modified:false,
                });
                console.log(indicator);
            });
    this.showPlot();
    this.updateIndicatorShapes(); // Mettre à jour les représentations visuelles des indicateurs


}
  addIndicator() {//ajout d'un indicateur vide lors du clique sur le bouton +
    this.IDIndicators = this.IDIndicators + 1 ;
    this.indicators.push({
      id:string(this.IDIndicators),
      type: "",
      value: 0,
      color: "#Ff0000",  // couleur par défaut si non spécifié
      fixed: false,
      modified:true
  })
  }

  removeIndicator(index: number, type: string) {
    // Suppression de l'indicateur
    this.indicators.splice(index, 1);
    this.layout?.shapes!.splice(index, 1);

    // Utilisation remove indicateur dans le backend
    this.jsonService.removeIndicator(this.simulation_id!, type).then(updatedIndicators => {
        this.results.indicators = updatedIndicators; // La promesse est résolue ici
        this.updateIndicatorShapes();
    }).catch(error => {
        console.error("Erreur lors de la suppression de l'indicateur:", error);
    });

    return this.indicators;
}

  onIndicatorTextChange(text : string, index : number){
    //changer le type de l'indicateur concerné
      this.indicators[index].type = text ?text:"";
      this.indicators[index].modified = true;
      this.updateIndicatorShapes();
      return this.indicators[index]
  }
  onIndicatorValueChange(value: number, index: number) {
      //changer la valeur de l'indicateur concerné
      this.indicators[index].value = value ?value:0;
      this.indicators[index].modified = true;
      this.updateIndicatorShapes();
      return this.indicators[index]
  }

  updateColorStyle(color : string ,index : number){
    //changer la couleur de l'indicateur concerné
    if(index!=0){
    this.indicators[index].color = color;
    this.indicators[index].modified = true;
    this.updateIndicatorShapes();
    }
    return this.indicators[index];
  }

  updateIndicatorShapes() {
    if(document.getElementById('previsions') && this.layout){
      // Initialise ou réinitialise les shapes à partir de ceux existants ou requis pour la simulation
      this.layout!.shapes = this.layout!.shapes?.filter(shape => shape.name === 'date de simulation') || [];
      this.indicators.forEach(indicator => {
          
        // Crée une nouvelle shape pour chaque indicateur
        this.layout!.shapes!.push({
          type: 'line',
          showlegend: true,
          name: indicator.type,
          x0: this.simulationStartDate,
          x1: this.simulationEndDate,
          y0: indicator.value,
          y1: indicator.value,
          line: {
            color: indicator.color,
            width: 2,
            dash: 'solid'
          },
          xref: 'x',
          yref: 'y'
        });
      });
      
      // Update le range Y 
      this.updateAxisY();
      this.layout!.yaxis!.range = this.range; 
  
      // Met à jour le graphe avec les nouvelles shapes et le nouveau range de l'axe y
      Plotly.relayout('previsions', { shapes: this.layout!.shapes, yaxis : this.layout!.yaxis});
      //Plotly.relayout('previsions', { shapes: this.layout!.shapes});
    }
  }

  async updateResults() {
    if (sessionStorage.getItem('lastSimulationId')) {
        // Créer une liste de promesses pour chaque indicateur modifié ( pour gérer le fonctionnement asynchorn)
        const updatePromises = this.indicators.map(async (modifIndi) => {
            if (modifIndi.modified === true) {
                // Attendre la mise à jour de l'indicateur modifié
                const updatedIndicators = await this.jsonService.updateIndicatorsValue(
                    sessionStorage.getItem('lastSimulationId')!,
                    this.indicators.filter(indicator => indicator.id === modifIndi.id)
                );
                
                // Mettre à jour dans this.results les indicateurs
                this.results.indicators = updatedIndicators;
                // remettre false pour l'incateur modifier
                modifIndi.modified = false;
            }
        });

        // Attendre que toutes les promesses soient résolues
        await Promise.all(updatePromises);
        // Afficher les indicateurs après mise à jour
        console.log("Noms après (results):", this.results.indicators);
    }
}


//PARTIE GRAPHIQUE MODELE HYDRO //  
  //crée les données en abscisses des traces du graphique (afin d'éviter de stocker les dates jour par jour)
  generateDateSeries(startDate: string, endDate: string): Date[] {
    let dates = [];
    let currentDate = new Date(startDate);

    while (currentDate <= new Date(endDate)) {
      dates.push(new Date(currentDate.toISOString().split('T')[0])); // Format as 'YYYY-MM-DD'
      currentDate.setDate(currentDate.getDate() + 1); // Increment day
    }
    return dates;
  }

  

  /**
   * Gestion des données et organisation des traces du graphique
   */
  updateGraphData(): void {//crée les traces du graphe
      // si les données de la simulation contient les données permettant la création du graphique
       if (this.showResults && this.results.results.data.graph) {
      //mettre à jour les données de axes x des observation et prediction 
      this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date);
      this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date); 
      // mettre à jour la date de début simulation
      this.startDate = new Date(this.results.results.similarity.user_similarity_period[0]);
      // variables pour les traces
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
   
      //GESTION DES DONNEES//
      // parcours les données permettant la création du graphique
      console.log(this.results.results.data.graph)
      console.log("selected",this.results)
      this.results.results.data.graph.forEach((line: { y: any[]; name: string; mode: string; line: any;}) => {
          if ( line.y ) {
              var parsedDates = this.XaxisPredictions;
                //met a jour la derniere date de prediction si elle n'existe pas , ou la dernière date de parseDates est supérieur à la dernier date stocké
                if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
                    this.endDate = parsedDates[parsedDates.length - 1];
                }
                // si la ligne est celle qui contient les données prédictions
                if (line.name != 'observations'){
                  //on parcours les dates dans les prédictions
                  for (let i = 0; i < parsedDates.length; i++) {
                    // Si la date actuelle est comprise entre la date de début de la simulation et la date de fin observée
                    if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                        this.maxPredictedValue.push(line.y[i]);
                    }
                  }
                }
                //si la ligne est celle qui contient les données q10
                if(line.name == 'Q10'){
                  // récupère les données  q10
                  q10Data = { x: this.XaxisPredictions, y: line.y };
                  // définie les dates dans incertitude
                  incertitudeX = parsedDates; 
                }

                //si la ligne est celle qui contient les données q90
                else if ( line.name == 'Q90'){
                    // si parseDates est initialisé
                    if (parsedDates.length > 0) {
                      // Définit la première date analysée comme date de début de simulation
                      this.simulationStartDate = parsedDates[0];
                      // Définit la dernière date analysée comme date de fin de simulation
                      this.simulationEndDate = parsedDates[parsedDates.length-1];
                    }
                  // Redéfinit la date de début de simulation   
                  this.simulationStartDate = parsedDates[0];
                  // récupère les données q90
                  q90Data = { x: parsedDates, y: line.y };
                }

                //si la ligne est celle qui contient les données q50
                else if ( line.name == 'Q50'){
                  q50X = this.XaxisPredictions;
                  q50Y = line.y;
                }

                //si la ligne est celle qui contient les données observations
                else if (line.name == 'observations'){
                  // récupère les données observation
                  observationsX = this.XaxisObservations; // Dates
                  observationsY = line.y; //Valeurs
                  // Partie pour gérer si la deniere date observations et la première date de simulation sont éloigné (plusieurs année)
                  // obtenir la taille des tableaux contenant les Dates et les valeurs  d'observation
                  let lengthX = observationsX.length; // Dates
                  let lengthY = observationsY.length; // Valeur
                  // Conversion format Date objects  pour trouver la date max dans les dates observation
                  let maxDateTimestamp = Math.max(...observationsX.map(date => new Date(date).getTime()));

                  // si on a la 1er date de simulation
                  if (this.simulationStartDate) {
                    // conversion au format Date object
                    let simulationStartDateTimestamp = new Date(this.simulationStartDate).getTime();
                
                    // vérifie si la date max dans observation est plus petite que la 1er date de simulation
                    if (maxDateTimestamp < simulationStartDateTimestamp) {
                        for (let i = 0; i < lengthX; i++) {
                          // Si une date d'observation est postérieure ou égale à la date de début de simulation, on met la valeur correspondante à null
                            if (new Date(observationsX[i]).getTime() >= simulationStartDateTimestamp) {
                                observationsY[i] = null;
                            }
                        }
                    }
                  }
                  // Si le nombre de valeurs d'observation est inférieur au nombre de dates d'observation
                  if (lengthY < lengthX) {
                    for (let i = lengthY; i < lengthX; i++) {
                      // Ajouter des valeurs null au début du tableau des valeurs pour correspondre aux dates supplémentaires
                        observationsY.unshift(null); 
                    }
                  }
                }

                //si la lignes est celle qui contient les données projection
                else if (line.name.includes('Projection')){
                  // Regroupe les données de projection dans un tableau pour une suppression en un clic sans doublon dans la légende.
                  // Les données sont alternées entre l'ordre normal et inversé pour éviter des lignes traversantes dans le graphique .
                  if(projectionDataReverse){
                    // met en normal les données
                  projectionData.x = projectionData.x.concat(this.XaxisPredictions);
                  projectionData.y = projectionData.y.concat(line.y);
                  }else{
                    //met en reverse les données
                    projectionData.x = projectionData.x.concat([...this.XaxisPredictions].reverse());
                    projectionData.y = projectionData.y.concat([...line.y].reverse());
                  }
                  
                  projectionDataReverse = !projectionDataReverse;
                  
                }
            // si les variables Accumulatrices de q10 et q90 ne sont pas vide     
            if (q10Data && q90Data) {
              // récupère les données incertitude en concatenant les données dans q90 et q10
                incertitudeX = q10Data.x.concat(q90Data.x.slice().reverse());
                incertitudeY = q10Data.y.concat(q90Data.y.slice().reverse());
                this.endDate = (q90Data as any).x[(q90Data as any).x.length-1]
              }
      }
      });

      //ORGANISATION DES TRACES// attention l'ordre de rentrer est important car plotly est en couche donc la dernière trace est au dessus de toutes les autres traces
      // si les données projection sont bien initalisé
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
        this.traces.push(projectionTrace);
      }
      
      // si les données q10 et q90 sont bien initalisé
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
            // fillcolor: 'rgba(64, 127, 189, 0.2)', 
            line: { color: '#1f78b4', width: 1 }, 
        };
        this.traces.push(incertitudeTrace);
      }

       // si les données q50 sont bien initalisé
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
        this.traces.push(q50Trace);
      }

      // si les données observation sont bien initalisé
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
        this.traces.push(observationsTrace); 
      }
      
    
    }
  }

  /**
   * calcul le ymax et ymin du graphiques 
   * en fonction des données des observation, prédictions et indicateurs 
   */
  updateYMinMax(){
    //calcul les  ymax et ymin des données obvervations et prédictions
    //Variable vide pour contenir les valeurs des indicateurs
    let indicatorValues: number[]= [];
    // parcours tous les indicateurs et récupère les valeurs des indicateurs
    this.indicators.forEach(indicator => {
      indicatorValues.push(indicator.value);
    })
    // calcul les valeurs Max et Min dans les valeurs des indicateurs
    const yMinindicator = Math.min(...indicatorValues);
    const yMaxindicator = Math.max(...indicatorValues);

    //calcul les  ymax et ymin des données obvervations et prédictions
    //Variable vide pour contenir les valeurs de Y ( observation et prédictions)
    let yValuesWithinObservedPeriod: number[] = [];
    //parcours les valeurs y( observation et prédiction) du graphique  
    this.results.results.data.graph.forEach((line: { y: number[]; name: string; }) => {
        // si il existe des valeurs dans y
        if ( line.y ) {
            // variable contenant les date des prédictions 
            var parsedDates = this.XaxisPredictions;
            // Variable contenant les date des observations
            var parsedDatesObservations = this.XaxisObservations;
            //met a jour la derniere date de prediction si elle n'existe pas , ou la dernière date de parseDates est supérieur à la dernier date stocké
            if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
                this.endDate = parsedDates[parsedDates.length - 1];
            }
            // si la ligne est celle qui contient les données prédictions
            if (line.name != 'observations'){
              //on parcours les dates dans les prédictions
              for (let i = 0; i < parsedDates.length; i++) {
                // Si la date actuelle est comprise entre la date de début et la date de fin observées
                if (parsedDates[i] >= this.startDate && parsedDates[i] <= this.endDate) {
                    yValuesWithinObservedPeriod.push(line.y[i]);
                }
                // Si la date actuelle est comprise entre la date de début de la simulation et la date de fin observée
                if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                    this.maxPredictedValue.push(line.y[i]);
                }
              }
            // si la ligne est celle qui contient les données observations
            }else{
              //on parcours les date dans observation
              for (let i = 0; i < parsedDatesObservations.length; i++) {
                // Si la date actuelle est comprise entre la date de début et la date de fin observées
                if (parsedDatesObservations[i] >= this.startDate && parsedDatesObservations[i] <= this.endDate) {
                    yValuesWithinObservedPeriod.push(line.y[i]);
                }
            }
          }
          // calcul les valeurs Max et Min dans les valeurs des observations et préditions
          const yMingraph = Math.min(...yValuesWithinObservedPeriod);
          const yMaxgraph = Math.max(...yValuesWithinObservedPeriod);  
          //Calcul le min et max entre les données des indateurs, observations et prédictions      
          this.yMin = Math.min(yMingraph,yMinindicator);
          this.yMax = Math.max(yMaxgraph,yMaxindicator);
        }
    });
  }

  /**
   * met à jour Axe Y du graphique en fonction du YMax et YMin
   * Si log On = alors calculer axe Y est mis en log
   */
  updateAxisY(){
    // calcul le ymax et ymin du graphiques 
    this.updateYMinMax();
    // ajoute un petit % pour ne pas avoir les lignes du graphique collés dans les coins
    const percentage = 0.10;
    const adjustedYMin = this.yMin * (1 - percentage);
    const adjustedYMax = this.yMax * (1 - percentage);
    // Définir le type en fonction de l'état de this.on
    this.type = this.on ? 'linear' : 'log';
    
    // Calculer les valeurs log si nécessaire
    const yMin = this.on ? adjustedYMin : Math.log10(adjustedYMin);
    const yMax = this.on ? adjustedYMax : Math.log10(adjustedYMax);
    
    // Vérification pour éviter l'inversion de l'axe
    this.range = yMin > yMax ? [yMax, yMin] : [yMin, yMax];
    
  }
  /**
   * mise en place du this.layout du graphique (legend, axes y/x et shape)
   * 
   */
  updateLayout() {
    //  met à jour Axe Y du graphique en fonction du YMax et YMin
    this.updateAxisY();
    // paramètre du this.layout du graphique
    this.layout = {
        hovermode: "x unified",
        title: {
            text: this.watershedID + " | " + this.stationName,
            font: { size: 20,  family: 'Segoe UI Semibold',  },
        },
        //paramètre de la lègende 
        legend: {
            orientation: 'h',
            font: { size: 16, color: '#333',     family: 'Segoe UI, sans-serif'},  // Police lisible et élégante
            x: 0.5,
            xanchor: 'center',
            y: 1.1,
            yanchor: 'top',
        },
        //paramètre de axe X
        xaxis: {
            title: '',
            showgrid: true,
            gridcolor: 'rgba(200, 200, 200, 0.3)',  // Grille discrète
            zeroline: false,
            tickformat: '%d-%m-%Y',
            tickmode: 'auto' as 'auto',
            tickangle: 0,
            ticks: 'inside',
            tickfont: { 
                size: 16, 
                family: 'Segoe UI Semibold',  // Ajoute Segoe UI
            },
            nticks: 10,
            range: [this.startDate, this.endDate],
            hoverformat: '%d %b %Y',
        },
        //paramètre de axe Y
        yaxis: {
            title: 'Débit [m³/s]',
            titlefont: { 
                size: 16, 
                family: 'Segoe UI Semibold',  // Ajoute Segoe UI
            },
            tickfont: { 
                size: 16, 
                family: 'Segoe UI Semibold',  // Ajoute Segoe UI
            },
            showline: false,
            ticks: 'inside',
            type: this.type as AxisType,
            range: this.range
        },
        // paramètre la ligne Date de simulation , sur la 1er date de simulation !
        shapes: this.simulationStartDate && this.simulationEndDate ? [{
            type: 'line',
            name: 'date de simulation',
            x0: this.simulationStartDate,
            x1: this.simulationStartDate,
            y0: 0.001,
            y1: this.yMax,
            line: {
                color: 'gray',
                width: 2,
                dash: 'dot'
            }
        }] : [],
        // Ajout des couleurs de fond transparentes
        paper_bgcolor: 'rgba(0, 0, 0, 0)', // Fond global transparent
        plot_bgcolor: 'rgba(0, 0, 0, 0)',  // Fond de la zone de traçage transparent
        margin: {
            l: 50,  // Espace à gauche pour les labels Y
            r: 30,  // Espace à droite pour ne pas couper les courbes
        },
        autosize: true,  // Le graphique s'adapte automatiquement à la taille du conteneur
    };
    
}

  /**
   * Permet d'afficher le graphique avec this.layout et this.trace 
   */
  showPlot() {
    // gere si this.results.results.data est une chaine String 
    if (Object.prototype.toString.call(this.results.results.data) === '[object String]') {
      try {
        // Nettoyer les valeurs non valides dans la chaîne JSON
        let cleanedData = this.results.results.data
        .replace(/NaN/g, 'null')
        .replace(/Infinity/g, 'null')
        .replace(/-Infinity/g, 'null');
        // Essayez de convertir la chaîne nettoyée en objet JSON
        this.results.results.data = JSON.parse(cleanedData);
    } catch (e) {
        console.error('La conversion de la chaîne en objet a échoué :', e);
      }
    }

  if(document.getElementById('previsions')){
      Plotly.newPlot('previsions', this.traces, this.layout, { responsive: true });
      const annotation: Partial<Plotly.Annotations> = {
        text: "Date de la simulation",
        xref: 'x', yref: 'paper',
        x:   this.simulationStartDate ? this.simulationStartDate.toISOString() : undefined, 
        y: 1,
        showarrow: false,
        font: { size: 14, family: 'Segoe UI Semibold', }
      };
      Plotly.relayout('previsions', { annotations: [annotation] ,width : document.getElementById('previsions')!.clientWidth });
    }
}  

      /**
         * trie les données du graphique et rend un fichier csv
         * 
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
            } else {
                dateIndices = predictionDateIndices;
                columnName = line.name; // Suppose que les noms sont 'Q90', 'Q50', 'Q10'
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
        const fileName = `prévision_${this.watershedName}_[${formattedStartDate}-${formattedEndDate}].csv`;

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


//PARTIE MATRICES //      

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
              font: {  
                size: 25,  
                color: 'black', 
                family: 'Arial, sans-serif',  
            } 
          },
              xaxis: {
                  tickangle: -90,
                  side: 'top',
                  automargin: true,
                  tickfont: {  
                    size: 14  
                } 
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
          }
          else{
            this.matricecolumn = false;
            const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
            const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.30 * window.innerWidth;
            Plotly.newPlot('matriceRecharge', DataMatrice, figLayout);
            Plotly.relayout('matriceRecharge',{width :matricewidth});
          }

        }
      }

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
            title: {
              text: '<b>Débits de cours d\'eau</b>',
              yanchor: 'bottom',  
              xanchor: 'center', 
              x: 0.5,  
              y: 0.05,
              font: {  
                size: 25,  
                color: 'black', 
                family: 'Arial, sans-serif',  
            }  
          },
              xaxis: {
                  tickangle: -90,
                  side: 'top',
                  automargin: true,
                  tickfont: {  
                    size: 14 
                }        
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
      
          if (this.stations.length >0){
            console.log("showing scenarios matrix")
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
              colorscale: [
                [0, 'rgba(0, 0, 0, 0.2)'], 
                [1, 'rgb(34, 94, 168)']  
              ],
              reversescale: false,
              showscale: false,
              xgap: 1,
              ygap: 1
            });
      
            // Calcul de la taille de la figure en fonction de la taille souhaitée des cases
            const caseHeight = 20; // Hauteur de chaque case en pixels
            const caseWidth = document.getElementById("matriceScenarios")!.clientWidth/transposedData[0].length;  // Largeur de chaque case en pixels
            console.log(caseWidth)
            const height = caseHeight * labeledStations.length; // Hauteur totale de la figure
            const width = caseWidth * index.length; // Largeur totale de la figure
            console.log(index.length)
            console.log(width)
            console.log(document.getElementById("matriceScenarios")!.clientWidth)
      
      
            // Calculate the width of the longest label
            const longestLabel = Math.max(...labeledStations.map((label: string | any[]) => label.length));
            const labelFontSize = this.scenariosMatrixFontSize; // Font size in pixels
            const figLayout: Partial<Layout> = {
                xaxis: {
                    tickangle: -90,
                    side: 'top',
                    automargin: true,
                    tickfont: {  
                      size: labelFontSize  
                  } 
                },
                yaxis: {
                    tickfont : {
                      size: labelFontSize,
                    },
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
      
        createMatrixStationLabel(stations: any[]){
          const labeledStations = stations.map((columnId: any) => {
            const station = this.stations.find(station => station.index.toLowerCase() === columnId.toLowerCase());
            const name = station ? station.name : "Unknown";
            return `${columnId} - ${name}`
        })
        return labeledStations
      
      }
      
        calculateMatrixWidth(id:string, labels :any [], fontsize :number){
          // return (document.getElementById(id)!.clientWidth + Math.max(...labels.map((label: string | any[]) => label.length)) * fontsize)*0.95;
          return (document.getElementById(id)!.clientWidth);
      
        }
        


  /**
   * gère les matrices à afficher celon les choix sélectionner dans le dropdown
   */
  renderMatrix() {
    this.cdr.detectChanges();
    if (this.selectedMatrix === 'recharge') {
      this.matriceRecharge();
    } else if (this.selectedMatrix === 'discharge') {
      this.matriceSpecificDischarge();
    }
    else if (this.selectedMatrix === 'all'){
      this.matriceRecharge();
      this.matriceSpecificDischarge();
    } 
  }
//PARTIE AFFICHAGE GENERAL//
    /**
   * met ajout les composants du résultat ( graphique , matrice , etc ...)
   * @param results 
   */
    private updateComponentsWithResults(results: any): void {
      // Mise à jour des résultats et de la matrice de corrélation
      this.results = results;
      this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.watershedName = this.results.watershed_name;
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

    openDialog() {
        this.dialog.open(Dialogsimulationresults);
    }

  openDialogViz(event: MouseEvent) {
    this.dialog.open(PopupDialogViz, {
      width: '800px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false
      // Pas de paramètres de position pour permettre un centrage automatique
    });
  }

//FONCTIONS POUR SIMPLIFIER LE CODE//        

        keys(obj: any) {//fonction pour retourner les clés d'un json
          return Object.keys(obj);
        }

        // Renvoie la valeur maximale
        max(v1: number, v2: number): number {
          return Math.max(v1, v2);
        }

        // Renvoie la valeur minimale
        min(v1: number, v2: number): number {
          return Math.min(v1, v2);
        }


  }

@Component({
  selector: 'popupDialogViz',
  templateUrl: './popupDialogViz.html',
})
export class PopupDialogViz {}


@Component({
  selector: 'dialog-simulation-results',
  templateUrl: './dialog-simulation-results.html',
  styleUrls: ['./dialog-simulation-results.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule],
})
export class Dialogsimulationresults {
  constructor(public dialogRef: MatDialogRef<Dialogsimulationresults>) {}

  onClose(): void {
    this.dialogRef.close();
  }

}

