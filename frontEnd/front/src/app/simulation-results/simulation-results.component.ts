import { Options } from '@angular-slider/ngx-slider/options';
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, SimpleChange, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import * as Plotly from 'plotly.js-dist';
import { Layout, PlotData } from 'plotly.js';
import { JsonService } from '../service/json.service';
import { switchMap } from 'rxjs';
import { AxisType } from 'plotly.js-dist';
import * as Papa from 'papaparse';
import { index, string } from 'mathjs';
import * as e from 'express';

@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss']
})
export class SimulationResultsComponent implements OnInit, OnDestroy {
  stations: any[] = [];
  selectedMatrix: string = 'all';
  on: boolean = false;
  private resizeListener : ()=> void;

  constructor(private jsonService: JsonService, public dialog : MatDialog, private cdr: ChangeDetectorRef){
    //listener permettant de redimensionner la map et le graphe en fonction de la taille de fenêtre
    this.resizeListener = () => {
      //const mapwidth = 0.40 * window.innerWidth;
      //const mapHeight = document.getElementById("matrice")!.clientHeight ;
      //Plotly.relayout('map', { width: mapwidth, height: mapHeight});

      const previsionGraphWidth = window.innerWidth * 0.80;
      Plotly.relayout('previsions', { width: previsionGraphWidth});
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
  @Input() watershedName: string | null | undefined;
  startDate: Date = new Date(this.results.results.similarity.user_similarity_period[0]);
  yMin = 0;
  yMax = 0;

  maxPredictedValue : number[] = [];

  XaxisObservations : Date[] = [];
  XaxisPredictions : Date[] = [];
  
  indicators: Array<Indicator> = [];

  colorScheme: Color = {
    name: 'default',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
  };

  

  ngOnInit(): void {
    this.simulation_id = localStorage.getItem('lastSimulationId')?localStorage.getItem('lastSimulationId'):null

    try{
      if(this.results.results.data){//générer les traces du graphe
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
        this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;     
      }else{
        console.log("Données manquantes lors du chargement de la matrice de corrélation")
      }
    }catch(error){
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
      this.initGDFStations();
    }


    try{//création des matrices de similarités
      if(this.results.results.similarity){
        this.cdr.detectChanges();
        this.matriceRecharge();
        this.matriceSpecificDischarge();
      }else{
        console.log("Données manquantes lors du chargement des matrices de similarités")
      }
    }catch(error){
      console.log("Problème lors du chargement des matrices de similarités : " + error)
    }
    
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(){//à la destruction du composant
    window.removeEventListener('resize', this.resizeListener);//détruire le listener
  }

  initGDFStations() {
    this.jsonService.getGDFStations().then(data => {
      this.stations = data;
      this.cdr.detectChanges();
      this.matriceRecharge();
      this.matriceSpecificDischarge();
    });
  }

  

  fillIndicators() {//ajouter les indicateurs de la base de données au tableau du front
    this.indicators = [];  // Réinitialiser le tableau des indicateurs
    this.results.indicators.forEach((indicator: { type: string; value : number; results: any; color :string})=> {
        let fixedValue = indicator.type === "1/10 du module";  // Déterminer si 'fixed' doit être true ou false
                this.indicators.push({
                    type: indicator.type,
                    value: indicator.value,
                    color: indicator.color,
                    fixed: fixedValue,
                    modified:false
                });
            });
    this.showPlot();
    this.updateIndicatorShapes(); // Mettre à jour les représentations visuelles des indicateurs
  }

  onToggleChange() {
    this.updateComponentsWithResults(this.results);
  }

  addIndicator() {//ajout d'un indicateur vide lors du clique sur le bouton +
    this.indicators.push({
      type: "",
      value: 0,
      color: "#Ff0000",  // couleur par défaut si non spécifié
      fixed: false,
      modified:true
  })
  }

  removeIndicator(index: number, type : string) {//suppression d'un indicateur
    this.indicators.splice(index,1);
    this.layout?.shapes!.splice(index,1);
    this.results.indicators = this.jsonService.removeIndicator(this.simulation_id!, type)
    this.updateIndicatorShapes();
    return this.indicators
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
    if(document.getElementById('previsions')){
      // Initialise ou réinitialise les shapes à partir de ceux existants ou requis pour la simulation
      this.layout!.shapes = this.layout!.shapes?.filter(shape => shape.name === 'date de simulation') || [];
    
      this.indicators.forEach(indicator => {
        // Crée une nouvelle shape pour chaque indicateur
        this.layout!.shapes!.push({
          type: 'line',
          showlegend : true,
          name :indicator.type,
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
    
      // Met à jour le graphe avec les nouvelles shapes
      Plotly.relayout('previsions', { shapes: this.layout!.shapes });
    }
  }


  async updateResults() {
    if(localStorage.getItem('lastSimulationId')){
      //mettre à jour tous les indicateurs que l'on a modifié  
      this.results.indicators = await this.jsonService.updateIndicatorsValue(localStorage.getItem('lastSimulationId')!,this.indicators.filter(indicator => indicator.modified==true))
      this.fillIndicators
    }
    
  }
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
  
  updateGraphData(): void {//crée les traces du graphe
   
    if (this.showResults && this.results.results.data.graph) {
      //mettre à jour les données de axes x des observation et prediction 
      this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date);
      this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date)
      this.traces= [];
      var q10Data: { x: Date[], y: number[] } | null = null;
      var q90Data: { x: Date[], y: number[] } | null = null;
      let incertitudeX;
      let incertitudeY;
      let q50X ;
      let q50Y ;
      let observationsX ;
      let observationsY ;

      this.startDate = new Date(this.results.results.similarity.user_similarity_period[0]);
      var yValuesWithinObservedPeriod: number[] = [];

      this.results.results.data.graph.forEach((line: { y: any[]; name: string; mode: string; line: any;}) => {
          if ( line.y ) {
              var parsedDates = this.XaxisPredictions;
              if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
                  this.endDate = parsedDates[parsedDates.length - 1];
              }
              for (let i = 0; i < parsedDates.length; i++) {
                if (parsedDates[i] >= this.startDate && parsedDates[i] <= this.endDate) {
                    yValuesWithinObservedPeriod.push(line.y[i]);
                }
                if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                    this.maxPredictedValue.push(line.y[i]);
                }

            }
            this.yMin = Math.min(...yValuesWithinObservedPeriod);
            this.yMin = Math.min(this.yMin, this.results.m10-1);
            this.yMax = Math.max(...yValuesWithinObservedPeriod);
            
            if(line.name == 'Q10'){
              q10Data = { x: this.XaxisPredictions, y: line.y };
              incertitudeX = parsedDates; 
            }
            else if ( line.name == 'Q90'){
              if (parsedDates.length > 0) {
                this.simulationStartDate = parsedDates[0];
                this.simulationEndDate = parsedDates[parsedDates.length-1];
              }
              this.simulationStartDate = parsedDates[0];
              q90Data = { x: parsedDates, y: line.y };
            }
            else if ( line.name == 'Q50'){
              q50X = this.XaxisPredictions;
              q50Y = line.y;
            }
            else if (line.name == 'observations'){
              observationsX = this.XaxisObservations;
              observationsY = line.y;
              // Get the lengths of XaxisObservations and observationsY
              let lengthX = observationsX.length;
              let lengthY = observationsY.length;
                              
              // Convert dates to Date objects for comparison
              let maxDateTimestamp = Math.max(...observationsX.map(date => new Date(date).getTime()));

              if (this.simulationStartDate) {
                let simulationStartDateTimestamp = new Date(this.simulationStartDate).getTime();
            
                // Check if the max date in XaxisObservations is less than simulationStartDate
                if (maxDateTimestamp < simulationStartDateTimestamp) {
                    // Replace values in observationsY with null if the date in observationsX is after simulationStartDate
                    for (let i = 0; i < lengthX; i++) {
                        if (new Date(observationsX[i]).getTime() >= simulationStartDateTimestamp) {
                            observationsY[i] = null;
                        }
                    }
                }
              }
              if (lengthY < lengthX) {
                for (let i = lengthY; i < lengthX; i++) {
                    observationsY.unshift(null); // Add null to the beginning of observationsY
                }
              }
              console.log(this.simulationStartDate);
              console.log(observationsY);
            }else if (line.name.includes('Projection')){
              var trace: Plotly.Data = {
                x: this.XaxisPredictions,
                y: line.y,
                showlegend : false,
                hoverinfo :'none',
                mode: 'lines',
                type: 'scatter',
                name: line.name,
                line: { color: '#e3dcda', width: 1 , dash: 'dash' },
              };
              this.traces.push(trace);
            }
              if (q10Data && q90Data) {
                incertitudeX = q10Data.x.concat(q90Data.x.slice().reverse());
                incertitudeY = q10Data.y.concat(q90Data.y.slice().reverse());
                this.endDate = (q90Data as any).x[(q90Data as any).x.length-1]
              }
            }
      });
     
      if (q10Data && q90Data){
        var incertitudeTrace: Plotly.Data = {
            x: incertitudeX,
            y: incertitudeY,
            mode: 'lines',
            type: 'scatter',
            name: "zone d'incertitude",
            showlegend : true,
            hoverinfo : 'none',
            fill: 'toself', 
            fillcolor: 'rgba(64, 127, 189, 0.3)', 
            line: { color: '#407fbd', width: 1 }, 
        };
        this.traces.push(incertitudeTrace);
      }
      if(q50X && q50Y){
        var q50Trace : Plotly.Data = {
          x : q50X,
          y : q50Y,
          mode: 'lines',
          type: 'scatter',
          name: 'projection médiane',
          showlegend : true,
          line: { color: 'blue', width: 1 , dash: 'dot' }, 
        };
        this.traces.push(q50Trace);
      }
      if(observationsX && observationsY){
        var observationsTrace : Plotly.Data = {
          x : observationsX,
          y : observationsY,
          mode: 'lines',
          type: 'scatter',
          name: 'observation',
          showlegend : true,
          // hoverinfo : 'none',
          line: { color: 'black', width: 1 }, 
        };
        this.traces.push(observationsTrace); 
      }
      
    
    }
  }

  updateLayout() {//mettre à jour le layout du graphe
    let range ;
    let type ;
    if (this.on) {
      range = [this.yMin, this.yMax];
      type = 'linear';
    } else {
      range = [Math.log10(this.yMin), Math.log10(this.yMax)];
      type = 'log';
    }
    this.layout = {
      hovermode: "x unified",
      title: {
        text: this.watershedName + " - "+ this.results.results.corr_matrix.length + " événements",
        font: {size: 17},
      },
      legend: {
        orientation: 'h',
        font: {size: 12},
        x: 0.5,
        xanchor: 'center',
        y: 1.2,
        yanchor: 'top',
      },
      xaxis: {
        title: '',
        showgrid: false,
        zeroline: false,
        tickformat: '%d-%m-%Y',
        tickmode: 'auto' as 'auto',
        tickangle: 45,
        ticks: 'inside',
        titlefont: {size: 12},
        nticks: 10,
        range: [this.startDate, this.endDate]
      },
      yaxis: {
        title: 'Débit (m3/s)',
        titlefont: {size: 12},
        showline: false,
        ticks: 'inside',
        type: type as AxisType,
        rangemode: 'tozero',
        range: range
      },
      shapes: this.simulationStartDate && this.simulationEndDate ? [{
        type: 'line',
        name:'date de simulation',
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
    };
}
  
  showPlot() {
  if(document.getElementById('previsions')){
      Plotly.newPlot('previsions', this.traces, this.layout);
      const annotation: Partial<Plotly.Annotations> = {
        text: "Date de la simulation",
        xref: 'x', yref: 'paper',
        x:   this.simulationStartDate ? this.simulationStartDate.toISOString() : undefined, 
        y: 1,
        showarrow: false,
        font: { size: 14 }
      };
      Plotly.relayout('previsions', { annotations: [annotation] ,width : document.getElementById('previsions')!.clientWidth });
    }
}

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
          const colorscale = [
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

          const DataMatrice: any[] = [];
          DataMatrice.push({
            z: modifiedData,
            x: columnNames,
            y: index,
            type: 'heatmap',
            colorscale: colorscale,
            reversescale: true,
            showscale: true,
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

          Plotly.newPlot('matriceRecharge', DataMatrice, figLayout);
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
          const colorscale = [
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

          const DataMatrice: any[] = [];
          DataMatrice.push({
            z: modifiedData,
            x: columnNames,
            y: index,
            type: 'heatmap',
            colorscale: colorscale,
            reversescale: true,
            showscale: true,
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

          Plotly.newPlot('matriceSpecificDischarge', DataMatrice, figLayout);
          }
        }


  ngAfterViewInit() {
    this.updateComponentsWithResults(this.results);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results'] && changes['results'].currentValue) {
      console.log('results changes');
      this.updateComponentsWithResults(changes['results'].currentValue);
    } 
  }



  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource!.filter = filterValue.trim().toLowerCase();
    if (this.dataSource!.paginator) {
      this.dataSource!.paginator.firstPage();
    }
  }


  private updateComponentsWithResults(results: any): void {
    // Mise à jour des résultats et de la matrice de corrélation
    this.results = results;
    this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  
    // Mise à jour des autres éléments
      this.fillIndicators();
      this.updateGraphData();
      this.updateLayout();
      this.showPlot();
      this.updateIndicatorShapes();
      this.matriceRecharge();
      this.matriceSpecificDischarge();
      //this.showTypologyMap();
  }

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


  

  openDialog() {
    this.dialog.open(Dialogsimulationresults);
  }

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
          
          //console.log(columnData);
                  
          
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

  }


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

interface Indicator {
  type: string;
  value: number;
  color: string;
  fixed: boolean;
  modified : boolean;
}

