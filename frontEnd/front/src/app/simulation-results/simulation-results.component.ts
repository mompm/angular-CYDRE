import { Options } from '@angular-slider/ngx-slider/options';
import { Component, Input, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Color, ScaleType } from '@swimlane/ngx-charts';
import * as Plotly from 'plotly.js-dist';

@Component({
  selector: 'app-simulation-results',
  templateUrl: './simulation-results.component.html',
  styleUrls: ['./simulation-results.component.scss']
})
export class SimulationResultsComponent implements OnInit {
  
  displayedColumns: string[] = ['Year', 'ID', 'Coeff'];
  dataSource!: MatTableDataSource<any>;

  sliderOptions: Options = {
    floor: 0,
    ceil: 1,
    step: 0.001,
    translate: (value: number): string => {
      return value.toString();
    }
  };

  @ViewChild(MatPaginator)
  paginator!: MatPaginator;
  @ViewChild(MatSort)
  sort!: MatSort;

  @Input() results: any = {
    proj_values: { Q50: 0, Q10: 0, Q90: 0 },
    ndays_before_alert_Q50: 1,
    ndays_before_alert_Q90: 1,
    ndays_before_alert_Q10: 1,
    ndays_below_alert: { Q50: 0, Q90: 0, Q10: 0 },
    prop_alert_all_series: 0,
    volume50: 0,
    volume10: 0,
    last_date: '',
    first_date: '',
    corr_matrix: [],
    scale: false,
    graph : false,
    similarity_period : [],
    m10 : 0.0
  };
  @Input() showResults: boolean = false;
  @Input() watershedName : string = "";
  m10sliderValue = this.results.m10 || 0.0;

  colorScheme: Color = {
    name: 'default',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
  };

  ngOnInit(): void {
    this.dataSource = new MatTableDataSource(this.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;  
    console.log("showresults",this.showResults)
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
    if (changes['results'] && document.getElementById('previsions')) {
      this.updateGraphData();
    }
  }

  onM10Change(value: number) {
    this.m10sliderValue = value;
    this.updateGraphData();
    this.updateRedLine();
  }

  updateGraphData(): void {
    if (this.showResults && this.results.graph && this.results.graph.data) {
        var traces: Plotly.Data[] = [];
        var q10Trace: Plotly.Data | undefined;
        var q90Trace: Plotly.Data | undefined;
        var startDate: Date = new Date(this.results.similarity_period[0]);
        var endDate: Date | undefined;
        var yValuesWithinObservedPeriod: number[] = [];
        var simulationStartDate: Date | undefined;
        var simulationEndDate: Date | undefined;

        this.results.graph.data.forEach((line: { x: any[]; y: any[]; name: string; mode: string; line: any; }) => {
            console.log('Processing line:', line);
            if (line.x && line.y && line.x.length === line.y.length) {
                var parsedDates = line.x.map(date => new Date(date));
                if (!endDate || parsedDates[parsedDates.length - 1] > endDate) {
                    endDate = parsedDates[parsedDates.length - 1];
                }

                for (let i = 0; i < parsedDates.length; i++) {
                  if (parsedDates[i] >= startDate && parsedDates[i] <= endDate) {
                      yValuesWithinObservedPeriod.push(line.y[i]);
                  }
              }

                var trace: Plotly.Data = {
                    x: parsedDates,
                    y: line.y,
                    mode: 'lines',
                    type: 'scatter',
                    name: line.name,
                    line: line.line
                };

                if (line.name === 'Q10') {
                    q10Trace = trace;
                } else if (line.name === 'Q90') {
                    if (line.x.length > 0) {
                        simulationStartDate = parsedDates[0];
                        simulationEndDate = parsedDates[parsedDates.length-1];
                    }
                    q90Trace = trace;
                } else {
                    traces.push(trace);
                }
            } else {
                console.error('Data length mismatch or invalid data', line);
            }
        });

        const HorizontalLineLegendTrace: Plotly.Data = {
          x: [0, 0],
          y: [0, 0],
          mode: 'lines',
          line: {
            color: 'red',
            width: 2,
            dash: 'solid'
          },
          showlegend: true,
          name: '1/10 du module',
        };
        traces.push(HorizontalLineLegendTrace);

        var yMin = Math.min(...yValuesWithinObservedPeriod);
        yMin = Math.min(yMin, this.results.m10-1);
        var yMax = Math.max(...yValuesWithinObservedPeriod);

        var layout: Partial<Plotly.Layout> = {
            title: 'Prévisions pour '+ this.watershedName,
            xaxis: {
                title: 'Date',
                showgrid: false,
                zeroline: false,
                tickformat: '%d-%m-%Y',
                tickmode: 'auto' as 'auto',
                nticks: 10,
                range: [startDate, endDate]
            },
            yaxis: {
                title: 'Débit (m3/s)',
                showline: false,
                range: [yMin, yMax]
            },
            shapes: simulationStartDate && simulationEndDate ? [{
              type: 'line',
              x0: simulationStartDate,
              x1: simulationStartDate,
              y0: yMin,
              y1: yMax,
              line: { 
                  color: 'gray',
                  width: 2,
                  dash: 'dot'
              }
          }, {
            type: 'line',
            x0: simulationStartDate,
            x1: simulationEndDate,
            y0: this.m10sliderValue,
            y1: this.m10sliderValue,
            line: {
                color: 'red',
                width: 2,
            }
        }] : [],
        };
        
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

            traces.push(q90Trace);
            traces.push(q10Trace);
        }

        this.showResults = true;
        Plotly.newPlot('previsions', traces, layout);
        
        const annotation: Partial<Plotly.Annotations>  = {
          text:  "Date de la simulation", 
          xref: 'paper', yref: 'paper',
          x: 0.5, y: 1.1,
          showarrow: false,
          font: { size: 14 }
        };

        Plotly.relayout('previsions', {annotations: [annotation]});

        window.addEventListener('resize', () => {
          const previsionGraphWidth = 0.72 * window.innerWidth;
          Plotly.relayout('previsions', { width: previsionGraphWidth });
        });
    }  
  }

  updateRedLine() {
    Plotly.relayout('previsions', {
      'shapes[1].y0': this.m10sliderValue,
      'shapes[1].y1': this.m10sliderValue,
    });
  }

  ngAfterViewInit() {
    this.dataSource = new MatTableDataSource(this.results.corr_matrix);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.updateGraphData();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}
