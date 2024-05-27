import { Component, Input, SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import * as chr from 'chroma-js';
import { median , quantile} from 'simple-statistics';
import * as math from 'mathjs';
import { from, of, zip } from 'rxjs';
import { filter, groupBy, mergeMap, toArray } from 'rxjs/operators';
import StationTemperaturedata from 'src/app/model/StationTemperaturedata';


@Component({
    selector: 'app-temperatureSeasonal',
    templateUrl: './temperatureSeasonal.component.html',
    styleUrls: ['./temperatureSeasonal.component.scss']
  })

  export class temperatureSeasonal {
    @Input() stationSelectionChange!: string;
    @Input() yearSelectionChange!: number[];
    temperatureStation: StationTemperaturedata[] = [];
    fig: any;
    months: string[] = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    tickvals: string[] = this.months.map((month, index) => `${index + 1 < 10 ? '0' : ''}${index + 1}-01`);
    ticktext: string[] = this.months.map(month => month);

    constructor(private dataService: DataService) {}

    ngOnInit() {
        this.initStationTemperature(this.stationSelectionChange);
      }

    ngOnChanges(changes: SimpleChanges) {
        // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
        if (changes['stationSelectionChange']) {
          this.initStationTemperature(changes['stationSelectionChange'].currentValue);
        }
        else if(changes['yearSelectionChange']){
            this.temperature_Seasonal();
        }
      }


    initStationTemperature(stationID: string){
        this.dataService.getMesurementStationTemperature(stationID).then(station => {
            this.temperatureStation = station; 
            this.temperature_Seasonal();  
        });
      }


    temperature_Seasonal() {
        const targetYears: number[] = this.yearSelectionChange;
        const processedData: any[] = [];
        const linesByYear = [];
        let lastUpdate = null;
        // Vérification si this.dischargeStation est défini et non vide
        if (this.temperatureStation && this.temperatureStation.length > 0) {
          for (const entry of this.temperatureStation) {
            const year = new Date(entry.t).getFullYear(); // Récupérer l'année de la date
            const month = new Date(entry.t).getMonth() + 1; // Récupérer le mois de la date
            const day = new Date(entry.t).getDate(); // Récupérer le jour de la date
            const currentDate = new Date(entry.t);
  
            if (!lastUpdate || currentDate > lastUpdate|| !isNaN(parseFloat(entry.t))) {
              lastUpdate = currentDate; 
            }
            // Formater le mois et le jour avec le format "mm-dd"
            const monthDay = `${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
      
            // Ajouter les données traitées dans un nouvel objet
            const newDataEntry = {
              Q: entry.Q,
              t: entry.t,
              years: year,
              daily: monthDay
            };
      
            // Ajouter cet objet au tableau de données traitées
            if (!isNaN(parseFloat(entry.Q))) {
              processedData.push(newDataEntry);
            }
  
            if (targetYears.includes(year)) {
              linesByYear.push(newDataEntry);
            }
          }
        } else {
          console.error("No data available in this.dischargeStation.");
        }
  

  
        const resultArray: { key: string; values: number[]; q10?: number;q50?: number;q90?: number; }[] = [];
        let q10: any;
        let q50: any;
        let q90: any;
        from(processedData)
          .pipe(
            filter(entry => !isNaN(parseFloat(entry.Q))),
            groupBy(
              processedData => processedData.daily,
              p => p.Q
            ),
            mergeMap(group => zip(of(group.key), group.pipe(toArray())))
          )
          .subscribe({
            //pour chaque daily 
            next: ([key, values]) => {
              const numericValues: number[] = values.map(value => parseFloat(value));
              // Calcule les quantiles et médiane
              q10 = (math.quantileSeq(numericValues, 0.1));
              //arrondi 4 chiffres après la virgule
              q10 =parseFloat(q10.toFixed(4));
              q50 = median(numericValues);
              q50 = parseFloat(q50.toFixed(4));
              q90 = math.quantileSeq(numericValues, 0.9);
              q90 = parseFloat(q90.toFixed(4));
              //push dans le tableau
              const entry = { key, values: numericValues, q10, q50, q90 };
              resultArray.push(entry);
            }
          });
  
          resultArray.sort((a, b) => {
            const [aMonth, aDay] = a.key.split('-').map(Number);
            const [bMonth, bDay] = b.key.split('-').map(Number);
            if (aMonth !== bMonth) {
              return aMonth - bMonth;
            } else {
              return aDay - bDay;
            }
          });
        const resultArraysKeys = resultArray.map(entry => entry.key);
        const variabilityX = resultArraysKeys.concat(resultArraysKeys.slice().reverse());
        const resultArrayq10 = resultArray.map(entry => entry.q10);
        const resultArrayq90 = resultArray.map(entry => entry.q90);
        const variabilityY =  resultArrayq10.concat(resultArrayq90.slice().reverse());
        
      this.fig = {
        data: [],
        layout: {
            title: { text: 'Température' ,font: {family: "Segoe UI Semibold", size: 22, color: "black"} },
            xaxis: { type: 'category',  'tickvals' : this.tickvals,'ticktext' : this.ticktext,tickfont: { size: 14, family: 'Segoe UI Semibold', color: 'black' }, 'gridwidth' : 0.01, 'gridcolor' : 'rgba(0,0,0,0.1)'},
            yaxis: { title: 'Température de l\'air [°C]', font: {family: "Segoe UI Semibold", size: 16, color: "black"},tickfont: { size: 14, family: 'Segoe UI Semibold', color: 'black'} ,showticklabels : true,gridwidth : 0.01, gridcolor : 'rgba(0,0,0,0.1)' },
            annotations: [
                { text: 'Mis à jour le : DATE', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 1.15, font: {"family": "Segoe UI Semilight Italic", "size": 18, "color": "#999"} },
                { text: 'Source : Météo France', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: -0.20, font: { "size":14, "color":"gray", "family":'Segoe UI Semilight' } }
            ],
            // Ajoutez les paramètres de mise en page saisonnière ici
            margin: { t: 125 },
            title_x: 0.5,
            hovermode: "x unified",
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)",
            legend: { orientation: "h", yanchor: "top", y: 1.1, xanchor: "right", x: 1 }
        }
    };
        const startYear = processedData.length > 0 ? processedData[1].years : 'N/A';
        const endYear = processedData.length > 0 ? processedData[processedData.length - 1].years : 'N/A';
        // Construction du libellé pour la moyenne
        const labelmedian = `moyenne [${startYear} - ${endYear}]`;
        const labelinvariant = `variabilité [${startYear} - ${endYear}]`;
  
    
        // trace median
        this.fig.data.push({
          x: resultArray.map(item => item.key),
          y: resultArray.map(item => item.q50),
          mode: 'lines',
          name: labelmedian,
          line: { color: 'black', width: 1.5, dash : 'dot' }
        });
  
        //trace invariant
        this.fig.data.push({
          x: variabilityX,
          y: variabilityY,
          fill: 'tozeroy', 
          fillcolor: 'rgba(183, 223, 255, 0.3)', 
          mode: 'none', 
          name: labelinvariant,
          hoverinfo: 'none' 
        });
        const lengthYear = targetYears.length;
        const chromaColors = chr.scale('Set1').colors(lengthYear);
            // Boucle sur les événements
      for (let i = 0; i < targetYears.length; i++) {
        const year = targetYears[i];
        const df_event = linesByYear.filter(item => item.years === year);
        if (df_event) {
          const trace = {
            x: df_event.map(item => item.daily),
            y: df_event.map(item => item.Q),
            mode: 'lines',
            name: String(year),
            line: {
              color: chromaColors[i], // Utilisation des couleurs générées par Chroma.js
              width: 1.5
            }
          };
          this.fig.data.push(trace); // Ajouter la trace à this.fig.data
        }
      }
      
        // Mettre à jour l'annotation pour afficher la date de mise à jour actuelle
        if (lastUpdate){       
          const currentDate = `${lastUpdate.getDate().toString().padStart(2, '0')}-${(lastUpdate.getMonth() + 1).toString().padStart(2, '0')}-${lastUpdate.getFullYear()}`;
          const updatedAnnotation = this.fig.layout.annotations.find((annotation: any) => annotation.text.includes('Mis à jour le :'));
          if (updatedAnnotation) {
            updatedAnnotation.text = `Mis à jour le : ${currentDate}`;
          }
      }
    
        // Tracer la figure Plotly
        Plotlydist.newPlot('temperatureSeasonal', this.fig.data, this.fig.layout);
      
      }
  


  }