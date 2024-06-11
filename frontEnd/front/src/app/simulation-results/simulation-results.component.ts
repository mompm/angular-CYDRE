import { Options } from '@angular-slider/ngx-slider/options';
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, SimpleChange, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import * as Plotly from 'plotly.js-dist';
import { JsonService } from '../service/json.service';
import { switchMap } from 'rxjs';
import { AxisType } from 'plotly.js-dist';
import { index, string } from 'mathjs';

@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss']
})
export class SimulationResultsComponent implements OnInit {
  on: boolean = false;
  
  constructor(private jsonService: JsonService, public dialog : MatDialog){}
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
  startDate: Date = new Date(this.results.results.similarity.user_similarity_period[0]);
  yMin = 0;
  yMax = 0;
  maxPredictedValue : number[] = [];

  
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
    console.log(this.results)
    this.simulation_id = localStorage.getItem('lastSimulationId')?localStorage.getItem('lastSimulationId'):null
    if(this.results.results.corr_matrix){//création de la matrice de corrélation
      this.dataSource = new MatTableDataSource(this.results.results.corr_matrix);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;     
    }else{
      console.log("Problème lors du chargement de la matrice de corrélation")
    }
    if(this.results.indicators){//création du tableau contenant les indicateurs
      this.fillIndicators();
    }else{
      console.log("Problème lors du chargement des indicateurs")
    }

    window.addEventListener('resize', () => {
      const previsionGraphWidth = document.getElementById('previsions')!.clientWidth*0.90;
      if (document.getElementById('previsions' )&& this.showResults) {
        Plotly.relayout('previsions', {width : previsionGraphWidth});
      }
        
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
                    fixed: fixedValue
                });
            });
    console.log(this.indicators)
    this.updateIndicatorShapes();  // Mettre à jour les représentations visuelles des indicateurs
    this.showPlot();
}

  onToggleChange() {
    this.updateComponentsWithResults(this.results);
}
  addIndicator() {
    this.indicators.push({
      type: "",
      value: 0,
      color: "#Ff0000",  // couleur par défaut si non spécifié
      fixed: false
  })
  console.log(this.indicators)

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
    console.log(this.indicators)
    return this.indicators
  }
  onIndicatorTextChange(text : string, index : number){
    //changer le type de l'indicateur concerné
      this.indicators[index].type = text ?text:"";
      this.updateIndicatorShapes();
      return this.indicators[index]
  }
  onIndicatorValueChange(value: number, index: number) {
      //changer la valeur de l'indicateur concerné
      this.indicators[index].value = value ?value:0;
      this.updateIndicatorShapes();
      return this.indicators[index]
  }


  updateColorStyle(color : string ,index : number){
    this.indicators[index].color = color;
    this.updateIndicatorShapes();
    return this.indicators[index];
  }

  updateIndicatorShapes() {
    // Initialise ou réinitialise les shapes à partir de ceux existants ou requis pour la simulation
    this.layout!.shapes = [];
  
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

  onM10Change(value: number) {
    // this.m10SliderValue = value;
    this.updateLayout();
    this.showPlot();
    this.showTypologyMap();
  }

  updateResults() {
    console.log("simulation_id:", this.simulation_id)
    if(localStorage.getItem('lastSimulationId')){
      console.log("updating results for ", localStorage.getItem('lastSimulationId'))  
      //mettre à jour tous les indicateurs sauf le mod10 que l'on ne modifie pas  
      this.jsonService.updateIndicatorsValue(localStorage.getItem('lastSimulationId')!,this.indicators.filter(indicator => indicator.type !== '1/10 du module')).subscribe(
        (data) => {this.results.indicators = data;
          this.fillIndicators()
        }
      );
    }
    
  }
  
  updateGraphData(): void {
   
    if (this.showResults && this.results.results.data.graph) {
      console.log("mise à jour du graphe")
      this.traces= [];
      var q10Data: { x: Date[], y: number[] } | null = null;
      var q90Data: { x: Date[], y: number[] } | null = null;
      let incertitudeX;
      let incertitudeY;
      let q50X ;
      let q50Y ;
      let observationsX ;
      let observationsY ;
      console.log(this.results.results.similarity.user_similarity_period);

      this.startDate = new Date(this.results.results.similarity.user_similarity_period[0]);
      var yValuesWithinObservedPeriod: number[] = [];

      this.results.results.data.graph.forEach((line: { x: any[]; y: any[]; name: string; mode: string; line: any;}) => {
          // console.log('Processing line:', line);
          if (line.x && line.y && line.x.length === line.y.length) {
              var parsedDates = line.x.map(date => new Date(date));
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
              q10Data = { x: parsedDates, y: line.y };
              incertitudeX = parsedDates; 
            }
            else if ( line.name == 'Q90'){
              if (line.x.length > 0) {
                this.simulationStartDate = parsedDates[0];
                this.simulationEndDate = parsedDates[parsedDates.length-1];
              }
              q90Data = { x: parsedDates, y: line.y };
            }
            else if ( line.name == 'Q50'){
              q50X = parsedDates;
              q50Y = line.y;
            }
            else if (line.name == 'observations'){
              observationsX = parsedDates;
              observationsY = line.y;
            }else if (line.name.includes('Projection')){
              var trace: Plotly.Data = {
                x: parsedDates,
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
          hoverinfo : 'none',
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

  updateLayout() {
    let range ;
    let type ;
    if (this.on) {
      range = [this.yMin, this.yMax];
      type = 'linear';
  } else {
      range = [Math.log10(0.01), Math.log10(this.yMax)];
      type = 'log';
  }
    this.layout = {
      hovermode: "x unified",
      title: {
        text: this.watershedName + " - "+ Object.keys(this.results.results.similarity.selected_scenarios).length + " événements",
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
        title: 'Date',
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
        margin: { l: 0, r: 0, t: 0, b: 0 }
      };
 
      Plotly.newPlot('map', figData, figlayout);

      window.addEventListener('resize', () => {
        const mapwidth = 0.40 * window.innerWidth;
        Plotly.relayout('map', { width: mapwidth });
      });
    });
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

      this.updateGraphData();
      this.updateLayout();
      this.showPlot();
      this.updateIndicatorShapes();
      this.showTypologyMap();

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
  fixed?: boolean;
}

