import { Component, Input, SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import { Layout ,AxisType} from 'plotly.js-dist';
import dataDischarge from 'src/app/model/dataDischarge';



@Component({
    selector: 'app-hydrographGlobal',
    templateUrl: './hydrographGlobal.component.html',
    styleUrls: ['./hydrographGlobal.component.scss']
  })
  export class hydrographGlobal{
    @Input() stationSelectionChange!: string;
    on: boolean = false;
    Datadischarge: dataDischarge[] = [];

    constructor(private dataService: DataService,private jsonService: JsonService) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['stationSelectionChange']) {
            this.initStationDischarge(changes['stationSelectionChange'].currentValue)
        }
      }


    initStationDischarge(stationID: string){
        this.jsonService.getDischarge(stationID).then(station => {
          this.Datadischarge = station;
          //console.log(this.Datadischarge);
          this.hydrograph();
        });
      }

    onToggleChange(){
    this.hydrograph();
    }

    hydrograph(){

      
        let df: { x: string; y: string; }[] = [];
  
        this.Datadischarge.forEach(station => {
          df.push({ x: station.t, y: station.Q });
        });
        
        const yLabel = "Débit (m3/s)";
  
        const data: Plotly.Data[] = [{
          x: df.map(entry => entry.x),
          y: df.map(entry => entry.y),
          type: 'scatter',
          mode: 'lines',
          line: { width: 1, color: '#006CD8' },
          name: yLabel
        }];
  
        const layout: Partial<Layout> = {
          title: {
              text: "Débits journaliers mesurés à la station hydrologique",
              x: 0.5,
              font: { family: "Segoe UI Semibold", size: 22, color: 'black' }
          },
          xaxis: { title: "Date" },
          yaxis: { 
              title: yLabel,
              type: this.on ? 'log' as AxisType : undefined 
          },
          font: { size: 14 },
          plot_bgcolor: "rgba(0,0,0,0)",
          paper_bgcolor: "rgba(0,0,0,0)"
        };
        
  
        Plotlydist.newPlot('hydrograph', data, layout);
        const name = this.Datadischarge[0];
        const annotation: Partial<Plotly.Annotations>  = {
          text:  `${name} [${this.stationSelectionChange}]`, 
          xref: 'paper', yref: 'paper',
          x: 0.5, y: 1.1,
          showarrow: false,
          font: { family:"Segoe UI Semilight Italic", size:18, color:"#999" }
        };
  
       Plotlydist.relayout('hydrograph', {annotations: [annotation]});
  
       window.addEventListener('resize', () => {
        const hydrographWidth = 0.72 * window.innerWidth;
        Plotlydist.relayout('hydrograph', { width: hydrographWidth });
      });
  
    }
    
  }

