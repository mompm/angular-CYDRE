import { Component, Input, SimpleChanges} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import * as chr from 'chroma-js';
import { median , quantile} from 'simple-statistics';
import * as math from 'mathjs';
import { from, of, range, zip } from 'rxjs';
import { filter, groupBy, mergeMap, toArray } from 'rxjs/operators';
import StationPrecipitationdata from 'src/app/model/StationPrecipitationdata';


@Component({
    selector: 'app-precipitationSeasonal',
    templateUrl: './precipitationSeasonal.component.html',
    styleUrls: ['./precipitationSeasonal.component.scss']
  })

  export class precipitationSeasonal {
    @Input() stationSelectionChange!: string;
    @Input() yearSelectionChange!: number[];
    precipitationStation : StationPrecipitationdata[] = [];
    fig: any;
    months: string[] = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    tickvals: string[] = this.months.map((month, index) => `${index + 1 < 10 ? '0' : ''}${index + 1}-01`);
    ticktext: string[] = this.months.map(month => month);

    constructor(private dataService: DataService) {}

    ngOnInit() {
        this.initStationPrecipitation(this.stationSelectionChange);
      }

    ngOnChanges(changes: SimpleChanges) {
        // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
        if (changes['stationSelectionChange']) {
          this.initStationPrecipitation(changes['stationSelectionChange'].currentValue);
        }
        else if(changes['yearSelectionChange']){
            this.Precipitation_Seasonal();
        }
      }


    initStationPrecipitation(stationID: string){
        this.dataService.getMesurementStationPrecipitationdata(stationID).then(station => {
            this.precipitationStation = station; 
            this.Precipitation_Seasonal();
        });
      }

    Precipitation_Seasonal() {
        const targetYears: number[] = this.yearSelectionChange;
        const processedData: any[] = [];
        const linesByYear = [];
        let lastUpdate = null;
        // Vérification si this.dischargeStation est défini et non vide
        if (this.precipitationStation && this.precipitationStation.length > 0) {
          for (const entry of this.precipitationStation) {
            const year = new Date(entry.t).getFullYear(); // Récupérer l'année de la date
            const month = new Date(entry.t).getMonth() + 1; // Récupérer le mois de la date
            const day = new Date(entry.t).getDate(); // Récupérer le jour de la date
            const currentDate = new Date(entry.t);
  
            if (!lastUpdate || currentDate > lastUpdate|| !isNaN(parseFloat(entry.Q))) {
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
            if (!isNaN(parseFloat(entry.Q)) && year !== 1958) {
              processedData.push(newDataEntry);
            }
  
          }
        } else {
          console.error("No data available in this.dischargeStation.");
        }
        
        const uniqueYears: number[] = [];

        // Récupérer les années uniques à partir des données traitées
        for (const entry of processedData) {
            if (!uniqueYears.includes(entry.years)) {
                uniqueYears.push(entry.years);
            }
        }

        for (const year of uniqueYears) {
            const yearData = processedData.filter(entry => entry.years === year);
            let cumulativeRainfall = 0.0;
        
            // Itérer sur chaque entrée de données pour l'année donnée
            for (const entry of yearData) {
                const rainfall = parseFloat(entry.Q); // Convertir la précipitation en nombre
                cumulativeRainfall += rainfall;
                entry.cumulative_daily_rainfall = cumulativeRainfall;
            }
        }

        for (const dataEntry of processedData) {
            if (targetYears.includes(dataEntry.years)) {
                linesByYear.push(dataEntry);
            }
          }

        const resultArray: { key: string; values: number[]; q10?: number;q50?: number;q90?: number;}[] = [];
        let q10: any;
        let q50: any;
        let q90: any;
        from(processedData)
          .pipe(
            filter(entry => !isNaN(parseFloat(entry.cumulative_daily_rainfall))),
            groupBy(
              processedData => processedData.daily,
              p => p.cumulative_daily_rainfall
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
          console.log("re", resultArray);
        const resultArraysKeys = resultArray.map(entry => entry.key);
        const variabilityX = resultArraysKeys.concat(resultArraysKeys.slice().reverse());
        const resultArrayq10 = resultArray.map(entry => entry.q10);
        const resultArrayq90 = resultArray.map(entry => entry.q90);
        const variabilityY =  resultArrayq10.concat(resultArrayq90.slice().reverse());
        
           
      this.fig = {
        data: [],
        layout: {
            title: { 
                text: 'Précipitations' ,
                font: {
                    family: "Segoe UI Semibold", 
                    size: 22, 
                    color: "black"
                } 
            },
            xaxis: { 
                type: 'category',  
                'tickvals' : this.tickvals,
                'ticktext' : this.ticktext,
                tickfont: { 
                    size: 14, 
                    family: 'Segoe UI Semibold', 
                    color: 'black' 
                }, 
                'gridwidth' : 0.01, 
                'gridcolor' : 'rgba(0,0,0,0.1)'
            },
            yaxis: { 
                title: 'Cumul des précipitations [mm]', 
                font: {
                    family: "Segoe UI Semibold", 
                    size: 16, 
                    color: "black"
                },
                tickfont: { 
                    size: 14, 
                    family: 'Segoe UI Semibold', 
                    color: 'black'
                }, 
                showticklabels: true, 
                gridwidth: 0.01, 
                gridcolor: 'rgba(0,0,0,0.1)', 
                
            },
            annotations: [
                {   text: 'Mis à jour le : DATE', 
                    showarrow: false, 
                    xref: 'paper', 
                    yref: 'paper', 
                    x: 0.5, 
                    y: 1.15, 
                    font: {
                        family: "Segoe UI Semilight Italic", 
                        size: 18, 
                        color: "#999"
                    } 
                },
                {   text: 'Source : Météo France', 
                    showarrow: false, 
                    xref: 'paper', 
                    yref: 'paper', 
                    x: 0.5, 
                    y: -0.20, 
                    font: { 
                        family:'Segoe UI Semilight',
                        size:14,
                        color:"gray"
                    } 
                }
            ],
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
            y: df_event.map(item => item.cumulative_daily_rainfall),
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
        Plotlydist.newPlot('precipitationSeasonal', this.fig.data, this.fig.layout);

        window.addEventListener('resize', () => {
          const hydrographWidth = 0.40 * window.innerWidth;
          Plotlydist.relayout('precipitationSeasonal', { width: hydrographWidth });
        });
      
      }
  


  }