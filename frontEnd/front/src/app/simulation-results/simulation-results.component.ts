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

@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss']
})
export class SimulationResultsComponent implements OnInit, OnDestroy {
  stations: any[] = [];
  selectedMatrix: string = 'all';
  on: boolean = false;
  range: number[] = [];
  type : any = "log";
  private resizeListener : ()=> void;

  constructor(private jsonService: JsonService, public dialog : MatDialog, private cdr: ChangeDetectorRef){
    this.resizeListener = () => {
      //const mapHeight = document.getElementById("matrice")!.clientHeight ;
      //Plotly.relayout('map', { width: mapwidth, height: mapHeight});
      const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
      const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.40 * window.innerWidth;
      Plotly.relayout('matriceRecharge',{width :matricewidth});
      Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
      

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

  taskId: string = "";
  @Input() simulation_id: string | undefined |  null = null
  @Input() showResults: boolean = false;
  @Input() watershedName: string | null | undefined;
  @Input() watershedID: string | null | undefined;
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

  sliderOptions: Options = {
    floor: 0,
    ceil: Math.max(this.yMax, 1),
    step: 0.001,
    translate: (value: number): string => {
      return value.toString();
    }
  };

  ngOnInit(): void {
    this.simulation_id = localStorage.getItem('lastSimulationId')?localStorage.getItem('lastSimulationId'):null
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
      this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date)
      this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date)
    }
    if(this.results.results.corr_matrix){//création de la matrice de corrélation
      this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;     
    }else{
      console.log("Problème lors du chargement de la matrice de corrélation")
    }
    if(this.results.indicators){//création du tableau contenant les indicateurs
      this.fillIndicators();
    if(this.results.results.similarity){
      this.initGDFStations();
    }
    }else{
      console.log("Problème lors du chargement des indicateurs")
    }
    
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(){
    window.removeEventListener('resize', this.resizeListener);
  }

  initGDFStations() {
    this.jsonService.getGDFStations().then(data => {
      this.stations = data;
      this.cdr.detectChanges();
      this.matriceRecharge();
      this.matriceSpecificDischarge();
    });
  }

  

  fillIndicators() {
    this.indicators = [];  // Réinitialiser le tableau des indicateurs
    // Supposons que `this.simulationData` contient le tableau des indicateurs
    this.results.indicators.forEach((indicator: { type: string; value : number; results: any; color :string})=> {
        // `data` est un objet avec `results`, `type`, et `value`
        let fixedValue = indicator.type === "1/10 du module";  // Déterminer si 'fixed' doit être true ou false
                this.indicators.push({
                    type: indicator.type,  // Ajouter la désignation du quantile au type
                    value: indicator.value,
                    color: indicator.color,  // Couleur par défaut, peut-être modifiée selon des règles spécifiques
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
  addIndicator() {
    this.indicators.push({
      type: "",
      value: 0,
      color: "#Ff0000",  // couleur par défaut si non spécifié
      fixed: false,
      modified:true
  })
  }

  removeIndicator(index: number, type : string) {
    this.indicators.splice(index,1);
    this.layout?.shapes!.splice(index,1);
    this.jsonService.removeIndicator(this.simulation_id!, type).subscribe({
      next: (response) => {
        this.results.indicators = response;
        console.log('Indicator removed successfully', response);
        // Handle additional logic after successful removal, like refreshing data
      },
      error: (error) => {
        console.error('Failed to remove indicator', error);
      }
    });
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
    if(index!=0){
    this.indicators[index].color = color;
    this.indicators[index].modified = true;
    this.updateIndicatorShapes();
    }
    return this.indicators[index];
  }

  updateIndicatorShapes() {
    if (document.getElementById('previsions')) {
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

  // onM10Change(value: number) {
  //   // this.m10SliderValue = value;
  //   this.updateLayout();
  //   this.showPlot();
  //   this.showTypologyMap();
  // }

  updateResults() {
    if(localStorage.getItem('lastSimulationId')){
      //mettre à jour tous les indicateurs sauf le mod10 que l'on ne modifie pas  
      this.jsonService.updateIndicatorsValue(localStorage.getItem('lastSimulationId')!,this.indicators.filter(indicator => indicator.modified==true)).subscribe(
        (data) => {this.results.indicators = data;
          this.fillIndicators()
        }
      );
    }
    
  }

  generateDateSeries(startDate: string, endDate: string): Date[] {
    let dates = [];
    let currentDate = new Date(startDate);

    while (currentDate <= new Date(endDate)) {
      dates.push(new Date(currentDate.toISOString().split('T')[0])); // Format as 'YYYY-MM-DD'
      currentDate.setDate(currentDate.getDate() + 1); // Increment day
    }
    return dates;
  }

  
  
  updateGraphData(): void {
   
    if (this.showResults && this.results.results.data.graph) {
      //mettre à jour les données de axes x des observation et prediction 
      this.XaxisObservations = this.generateDateSeries(this.results.results.data.first_observation_date,this.results.results.data.last_observation_date);
      this.XaxisPredictions = this.generateDateSeries(this.results.results.data.first_prediction_date,this.results.results.data.last_prediction_date);
      this.traces= [];
      var q10Data: { x: Date[], y: number[] } | null = null;
      var q90Data: { x: Date[], y: number[] } | null = null;
      var projectionData: { x: Date[], y: number[] } = { x: [], y: [] }; // Accumulateur pour les projections
      let projectionDataReverse = true;
      let incertitudeX;
      let incertitudeY;
      let q50X ;
      let q50Y ;
      let observationsX ;
      let observationsY ;

      this.startDate = new Date(this.results.results.similarity.user_similarity_period[0]);
      this.results.results.data.graph.forEach((line: { y: any[]; name: string; mode: string; line: any;}) => {
          if ( line.y ) {
              var parsedDates = this.XaxisPredictions;
              if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
                  this.endDate = parsedDates[parsedDates.length - 1];
              }
              if (line.name != 'observations'){
                for (let i = 0; i < parsedDates.length; i++) {
                  if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                      this.maxPredictedValue.push(line.y[i]);
                  }
                }
              }
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
            }else if (line.name.includes('Projection')){
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
              if (q10Data && q90Data) {
                incertitudeX = q10Data.x.concat(q90Data.x.slice().reverse());
                incertitudeY = q10Data.y.concat(q90Data.y.slice().reverse());
                this.endDate = (q90Data as any).x[(q90Data as any).x.length-1]
              }
            }
      });
      
      if (projectionData.x.length > 0 && projectionData.y.length > 0) {
        var projectionTrace: Plotly.Data = {
          x: projectionData.x,
          y: projectionData.y,
          showlegend: true,
          hoverinfo: 'none',
          mode: 'lines',
          type: 'scatter',
          name: 'projection', 
          line: { color: '#e3dcda', width: 1, dash: 'dash' },
        };
        this.traces.push(projectionTrace);
      }
        
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
          hovertemplate: 'projection médiane: %{y:.3f} m³/s<extra></extra>',
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
          hovertemplate: 'observation: %{y:.3f} m³/s<extra></extra>',
          line: { color: 'black', width: 1 }, 
        };
        this.traces.push(observationsTrace); 
      }
      
      this.updateSliderOptions();
    
    }
  }

  updateSliderOptions() {
    this.sliderOptions = {
      floor: 0,
      ceil: Math.max(...this.maxPredictedValue, 1),
      step: 0.001,
      translate: (value: number): string => {
        return value.toString();
      }
    };
  }

  /**
   * met à jour ymax et ymin 
   */
  updateYMinMax(){
    //met à jour ymax et ymin des incateurs
    let indicatorValues: number[]= [];
    this.indicators.forEach(indicator => {
      indicatorValues.push(indicator.value);
    })
    const yMinindicator = Math.min(...indicatorValues);
    const yMaxindicator = Math.max(...indicatorValues);

    //met à jour ymax et ymin des données obvervations et prédictions
    let yValuesWithinObservedPeriod: number[] = [];
    this.results.results.data.graph.forEach((line: { y: number[]; name: string; }) => {
        if ( line.y ) {
            var parsedDates = this.XaxisPredictions;
            var parsedDatesObservations = this.XaxisObservations;
            if (!this.endDate || parsedDates[parsedDates.length - 1] > this.endDate) {
                this.endDate = parsedDates[parsedDates.length - 1];
            }
            if (line.name != 'observations'){
              for (let i = 0; i < parsedDates.length; i++) {
                if (parsedDates[i] >= this.startDate && parsedDates[i] <= this.endDate) {
                    yValuesWithinObservedPeriod.push(line.y[i]);
                }
                if (parsedDates[i] >= this.simulationStartDate! && parsedDates[i] <= this.endDate) {
                    this.maxPredictedValue.push(line.y[i]);
                }
              }
            }else{
              for (let i = 0; i < parsedDatesObservations.length; i++) {
                if (parsedDatesObservations[i] >= this.startDate && parsedDatesObservations[i] <= this.endDate) {
                    yValuesWithinObservedPeriod.push(line.y[i]);
                }
            }
          }
          const yMingraph = Math.min(...yValuesWithinObservedPeriod);
          const yMaxgraph = Math.max(...yValuesWithinObservedPeriod);  
          //observe le min et max entre les données des indateurs, observations et prédictions      
          this.yMin = Math.min(yMingraph,yMinindicator);
          this.yMax = Math.max(yMaxgraph,yMaxindicator);
        }
    });
  }

  /**
   * 
   */
  updateAxisY(){
    this.updateYMinMax();
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

  updateLayout() {
    this.updateAxisY();
    this.layout = {
        hovermode: "x unified",
        title: {
            text: this.watershedID + " | " + this.watershedName,
            font: { size: 17 },
        },
        legend: {
            orientation: 'h',
            font: { size: 12 },
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
            titlefont: { size: 12 },
            nticks: 10,
            range: [this.startDate, this.endDate],
            hoverformat: '%d %b %Y',
        },
        yaxis: {
            title: 'Débit (m3/s)',
            titlefont: { size: 12 },
            showline: false,
            ticks: 'inside',
            type: this.type as AxisType,
            range: this.range
        },
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
    };
    
}

  
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


  showTypologyMap(){
    const figData: any[] = [];
    this.jsonService.getGDFStations().then(data => {
      const filteredStations = data.filter(station => 
        this.results.results.similarity.similar_watersheds.includes(station.index)
      );

      const x: any[] = [];
      const y: any[] = [];
      const text: any[] = []; 

      for (let i = 0; i < filteredStations.length; i++) {
          x.push(Number(filteredStations[i].x_outlet)); 
          y.push(Number(filteredStations[i].y_outlet)); 
          text.push(`${filteredStations[i].station_name}`);
      }
      figData.push({
        type: 'scattermapbox',
        lon: x,
        lat: y,
        mode: 'markers',
        hoverinfo: 'text',
        hovertext: text,
        name: '',
    });
      const figlayout = {
        mapbox: {
          style: 'open-street-map',
          center: { lat: 48.2141667, lon: -2.9424167 },
          zoom: 6.8
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, t: 0, b: 0 },
        width:0.40 * window.innerWidth,
        height : document.getElementById("matrice")!.clientHeight
      };
 
      Plotly.newPlot('map', figData, figlayout);
  })
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

          const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
          const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.40 * window.innerWidth;
          Plotly.newPlot('matriceRecharge', DataMatrice, figLayout);
          Plotly.relayout('matriceRecharge',{width :matricewidth});
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

          const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
          const matricewidth = isSmallScreen ? 0.50 * window.innerWidth : 0.40 * window.innerWidth;
          Plotly.newPlot('matriceSpecificDischarge', DataMatrice, figLayout);
          Plotly.relayout('matriceSpecificDischarge',{width :matricewidth});
          }
        }


  ngAfterViewInit() {
    this.updateComponentsWithResults(this.results);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['results'] && changes['results'].currentValue) {
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

