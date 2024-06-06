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
import * as Papa from 'papaparse';

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
    proj_values: { Q50: 0, Q10: 0, Q90: 0 },
    ndays_before_alert_Q50: { Q50: 0, Q90: 0, Q10: 0 },
    ndays_below_alert: { Q50: 0, Q90: 0, Q10: 0 },
    prop_alert_all_series: 0,
    volume50: 0,
    volume10: 0,
    last_date: '',
    first_date: '',
    scale: false,
    graph: false,
    similarity_period: [],
    m10: 0.0, 
    compute_matrix : false,
    corr_matrix: [],
    task_id:"",
    similar_watersheds: [],
    nombre_evenement: 0

  };

  taskId: string = "";

  @Input() corr_matrix: any[] = [];
  @Input() showResults: boolean = false;
  @Input() watershedName: string | null | undefined;
  
  @Input() m10SliderValue = this.results.m10 || 0.0;
  startDate: Date = new Date(this.results.similarity_period[0]);
  yMin = 0;
  yMax = 0;
  maxPredictedValue : number[] = [];

  indicators: Array<{type: string, value: number, color: string, fixed?: boolean}> = [
  ];
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
    this.dataSource = new MatTableDataSource(this.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort; 
    this.indicators.push({type: 'mod10', value: this.m10SliderValue, color:'#Ff0000', fixed: true} )
    console.log("showresults", this.showResults);

    window.addEventListener('resize', () => {
      const previsionGraphWidth = document.getElementById('previsions')!.clientWidth*0.90;
      if (document.getElementById('previsions' )&& this.showResults) {
        Plotly.relayout('previsions', { width: previsionGraphWidth });
        
      }
    });
  }

  onToggleChange() {
    this.updateComponentsWithResults(this.results);
}
  addIndicator() {
    this.indicators.push({type: '', color: '#Ff0000' , value: 0}); 
  }

  removeIndicator(index: number) {
    if (!this.indicators[index].fixed) { // Assurez-vous que l'indicateur n'est pas fixe avant de le supprimer
      this.indicators.splice(index, 1);
      this.updateIndicatorShapes();
    }
  }
  onIndicatorValueChange(value: number, index: number) {
    if(value){
      if(this.indicators[index].type=='mod10'){
        this.onM10Change(value);
      }else {
        this.indicators[index].value = value;
        this.updateIndicatorShapes(); // Met à jour le graphe après un changement de valeur
      }
  }

  }

  updateColorStyle(indicator : any){
    return { 'background-color': indicator.color };
  }

  updateIndicatorShapes() {
    // Initialise ou réinitialise les shapes à partir de ceux existants ou requis pour la simulation
    this.layout!.shapes = this.layout!.shapes?.filter(shape => shape.name === 'SimulationPeriod') || [];
  
    this.indicators.forEach(indicator => {
      // Crée une nouvelle shape pour chaque indicateur
      this.layout!.shapes!.push({
        type: 'line',
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
    this.m10SliderValue = value;
    this.updateLayout();
    this.showPlot();
    this.showTypologyMap();
    this.m10SliderValue = value;
    this.updateLayout();
    this.showPlot();
    this.showTypologyMap();
  }

  updateResults() {
    if(this.results.task_id != ""){
      this.jsonService.updateM10Value({ "m10": this.m10SliderValue }).pipe(
        switchMap(() => this.jsonService.getM10Values(this.results.task_id)) // Utilisez le task ID ici
      ).subscribe(
        (data) => {
          this.results.ndays_below_alert = data.ndays_below_alert;
          this.results.ndays_before_alert = data.ndays_before_alert;
          this.results.prop_alert_all_series = data.prop_alert_all_series;
          this.results.volume10 = data.volume10;
          this.results.volume50 = data.volume50;
          this.results.volume90 = data.volume90;
          console.log('Updated results:', data);
        },
        (error) => {
          console.error('Error updating results:', error);
        }
      );
    }
  }
  
  updateGraphData(): void {
   
    if (this.showResults && this.results.graph && this.results.graph.data) {
      this.traces= [];
      var q10Data: { x: Date[], y: number[] } | null = null;
      var q90Data: { x: Date[], y: number[] } | null = null;
      let incertitudeX ;
      let incertitudeY ;
      let q50X ;
      let q50Y ;
      let observationsX ;
      let observationsY ;
     

      this.startDate = new Date(this.results.similarity_period[0]);
      var yValuesWithinObservedPeriod: number[] = [];

      this.results.graph.data.forEach((line: { x: any[]; y: any[]; name: string; mode: string; line: any;}) => {
          //console.log('Processing line:', line);
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
        text: this.watershedName + " - "+ this.results.nombre_evenement + " événements",
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
      }, {
        type: 'line',
        showlegend : true,
        name :"1/10 du module",
        x0: this.simulationStartDate,
        x1: this.simulationEndDate,
        y0: this.m10SliderValue,
        y1: this.m10SliderValue,
        line: {
          color: 'red',
          width: 2,
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
        this.results.similar_watersheds.includes(station.index)
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
    this.dataSource = new MatTableDataSource(this.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  
    // Mise à jour des autres éléments

      this.updateGraphData();
      this.updateLayout();
      this.showPlot();
      this.showTypologyMap();

  }

  openDialog() {
    this.dialog.open(Dialogsimulationresults);
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
    const filteredData = this.results.graph.data.filter((line: { name: string }) => {
        return !line.name.includes('Projection');
    });

    // Extraction des dates uniques (x) dans l'intervalle [startDate, endDate]
    const dates = new Set<string>();
    filteredData.forEach((line: { x: string[]; y: number[] }) => {
        line.x.forEach(date => {
            const currentDate = new Date(date);
            if (currentDate >= startDate && currentDate <= endDate) {
                dates.add(date);
            }
        });
    });

    // Tri des dates pour avoir un ordre chronologique
    const sortedDates = Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    sortedDates.reverse();
    
    // Préparer l'objet pour stocker les données en colonnes avec dates
    const columnData: { [date: string]: { [columnName: string]: any } } = {};
    sortedDates.forEach(date => {
        columnData[date] = {
            Q90: '',
            Q50: '',
            Q10: '',
            observation: ''
        };
    });

    // Boucler sur les données filtrées pour regrouper les valeurs par date
    filteredData.forEach((line: { name: string; x: string[]; y: number[] }) => {
        line.x.forEach((date, index) => {
            if (columnData[date]) {
                columnData[date][line.name] = line.y[index];
            }
        });
    });

    // Construire le CSV avec en-têtes
    let csv = 'Date,Q90,Q50,Q10,observations\n';
    sortedDates.forEach(date => {
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
