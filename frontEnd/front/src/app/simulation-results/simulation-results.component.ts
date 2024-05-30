import { Options } from '@angular-slider/ngx-slider/options';
import { Component, Input, OnInit, SimpleChange, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import * as Plotly from 'plotly.js-dist';
import { JsonService } from '../service/json.service';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss']
})
export class SimulationResultsComponent implements OnInit {
  
  constructor(private jsonService: JsonService){}
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
    similar_watersheds: []

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

    console.log("showresults", this.showResults);

    window.addEventListener('resize', () => {
      const previsionGraphWidth = document.getElementById('previsions')!.clientWidth*0.90;
      if (document.getElementById('previsions' )&& this.showResults) {
        Plotly.relayout('previsions', { width: previsionGraphWidth });
      }
    });
  }


  onM10Change(value: number) {
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
      var q10Trace: Plotly.Data | undefined;
      var q90Trace: Plotly.Data | undefined;
      var observations: Plotly.Data | undefined;

      this.startDate = new Date(this.results.similarity_period[0]);
      var yValuesWithinObservedPeriod: number[] = [];
      

      this.results.graph.data.forEach((line: { x: any[]; y: any[]; name: string; mode: string; line: any;}) => {
          console.log('Processing line:', line);
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



              var trace: Plotly.Data = {
                  x: parsedDates,
                  y: line.y,
                  mode: 'lines',
                  type: 'scatter',
                  name: line.name,
                  line: line.line,
              };

              if (line.name === 'Q10') {
                  q10Trace = trace;
              } else if (line.name === 'Q90') {
                  if (line.x.length > 0) {
                    this.simulationStartDate = parsedDates[0];
                    this.simulationEndDate = parsedDates[parsedDates.length-1];
                  }
                  q90Trace = trace;
              } else {
                if(line.name.includes("Projection")){
                  trace.showlegend = false;
                  trace.hoverinfo = 'none'
                  trace.line!.dash = 'dash';
                  trace.line!.color = 'rgba(0, 0, 255, 0.1)';
                }else if(line.name == 'Q50') {
                  observations = trace;
                }else{
                trace.hoverinfo = 'all';
                }
                this.traces.push(trace);
              }
          } else {
              console.error('Data length mismatch or invalid data', line);
          }
      });
          if (q10Trace && q90Trace) {
            (q90Trace as any).fill = null;
            (q90Trace as any).fillcolor = 'rgba(64, 127, 189, 0.3)';
            (q90Trace as any).line = { color: '#407fbd', width: 1 };
            (q90Trace as any).showlegend = false;
            (q90Trace as any).hoverinfo = 'skip';

            (q10Trace as any).fill = 'tonexty';
            (q10Trace as any).fillcolor = 'rgba(64, 127, 189, 0.3)';
            (q10Trace as any).line = { color: '#407fbd', width: 1 };
            (q10Trace as any).name = "zone d'incertitude";
            (q10Trace as any).hoverinfo = 'skip';

            this.traces.push(q90Trace);
            this.traces.push(q10Trace);
            this.traces.push(observations!);
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
    this.layout = {
      title: 'Prévisions pour ' + this.watershedName,
      xaxis: {
        title: 'Date',
        showgrid: false,
        zeroline: false,
        tickformat: '%d-%m-%Y',
        tickmode: 'auto' as 'auto',
        nticks: 10,
        range: [this.startDate, this.endDate]
      },
      yaxis: {
        title: 'Débit (m3/s)',
        showline: false,
        range: [this.yMin, this.yMax]
      },
      shapes: this.simulationStartDate && this.simulationEndDate ? [{
        type: 'line',
        x0: this.simulationStartDate,
        x1: this.simulationStartDate,
        y0: this.yMin,
        y1: this.yMax,
        line: { 
          color: 'gray',
          width: 2,
          dash: 'dot'
        }
      }, {
        type: 'line',
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
      xref: 'paper', yref: 'paper',
      x: 0.5, y: 1.1,
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

}
