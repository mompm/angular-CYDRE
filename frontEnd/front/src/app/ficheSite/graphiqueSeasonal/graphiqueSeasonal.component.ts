import { Component, Input, SimpleChanges, OnDestroy, HostListener} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import { median , quantile} from 'simple-statistics';
import * as math from 'mathjs';
import { from, of, range, zip } from 'rxjs';
import { filter, groupBy, mergeMap, toArray } from 'rxjs/operators';
import dataPrecipitation from 'src/app/model/dataPrecipitation';
import { ColorService } from 'src/app/color-service.service';
import dataDepth from 'src/app/model/dataDepth';
import dataTemperature from 'src/app/model/dataTemperature';
import dataDischarge from 'src/app/model/dataDischarge';


/**
 * Composant Angular pour afficher les précipitations saisonnières.
 */
@Component({
    selector: 'app-graphiqueSeasonal',
    templateUrl: './graphiqueSeasonal.component.html',
    styleUrls: ['./graphiqueSeasonal.component.scss']
})


export class graphiqueSeasonal implements OnDestroy {
  private resizeListener: ()=> void;
  @Input() GraphType! : string; // Type du graphique ('depth', 'temperature', 'precipitation', 'hydrograph').
  @Input() stationSelectionChange!: string; // Identifiant de la station sélectionnée
  @Input() yearSelectionChange!: number[]; // Liste des années sélectionnées

  DataStation: any[] = []; // Données de précipitations pour la station
  fig: any; // Objet de configuration pour le graphique Plotly
  months: string[] = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  tickvals: string[] = this.months.map((month, index) => `${index + 1 < 10 ? '0' : ''}${index + 1}-01`);
  ticktext: string[] = this.months.map(month => month);
  TabDataByDaily: any[] = []; //tableau contenant toutes les données Precipitation triés
  YearTabDataByDaily: any[] = []; //tableau contenant les données Precipitation triés des années selectionné
  lastUpdate: any | null;// dernière update des données des données Precipitation
  resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = []; // tableau contenant les quantiles 

  /**
  * Constructeur de la classe.
  * 
  * @param dataService Service de gestion des données
  * @param jsonService Service de gestion des JSON
  */
  constructor(private dataService: DataService, private jsonService: JsonService, private colorService : ColorService) {
    this.resizeListener = () => {
      const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
      const hydrographWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth;
    
      if (this.GraphType === 'depth') {
        Plotlydist.relayout('depthSeasonal', { width: hydrographWidth });
      }
      else if (this.GraphType === 'temperature') {
        Plotlydist.relayout('temperatureSeasonal', { width: hydrographWidth });
      }
      else if (this.GraphType === 'precipitation') {
        Plotlydist.relayout('precipitationSeasonal', { width: hydrographWidth });
      }
      else if (this.GraphType === 'hydrograph') {
        Plotlydist.relayout('hydrographSeasonal', { width: hydrographWidth });
      }
    };
  }
  
  // You should add the resize event listener to call the resizeListener method when the window is resized
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeListener();
  }

  /**
  * Initialisation du composant.
  * Cette méthode est appelée une fois que les propriétés @Input ont été initialisées.
  */
  ngOnInit() {
    window.addEventListener('resize', this.resizeListener);
    if(this.GraphType == 'depth'){
      this.initStationDepth(this.stationSelectionChange);
      console.log("depth")
    }
    else if (this.GraphType == 'temperature'){
      this.initStationTemperature(this.stationSelectionChange);
      console.log("temperature")
    }
    else if (this.GraphType == 'precipitation'){
      this.initStationPrecipitation(this.stationSelectionChange);
    } 
    else if (this.GraphType == 'hydrograph'){
      this.initStationDischarge(this.stationSelectionChange);
    }
    else {
      console.log("type de graphique non valide")
    } 
    
  }
  
  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  /**
  * Méthode appelée à chaque changement des valeurs des propriétés @Input.
  * 
  * @param changes Objet contenant les valeurs changées
  */
  ngOnChanges(changes: SimpleChanges) {
      console.log("Changements détectés :", changes); // Vérification des changements
      // Cette méthode est appelée chaque fois que les valeurs des propriétés @Input changent
      if (changes['stationSelectionChange']) {
        if(this.GraphType == 'depth'){
          this.initStationDepth(changes['stationSelectionChange'].currentValue);
        }
        else if (this.GraphType == 'temperature'){
          this.initStationTemperature(changes['stationSelectionChange'].currentValue);
        }
        else if (this.GraphType == 'precipitation'){
          this.initStationPrecipitation(changes['stationSelectionChange'].currentValue);
        } 
        else if (this.GraphType == 'hydrograph'){
          this.initStationDischarge(changes['stationSelectionChange'].currentValue);
        }
        else {
          console.log("type de graphique non valide")
        } 
      }
      else if(changes['yearSelectionChange']){
        if(this.GraphType == 'depth'){
          this.create_graph_seasonal("depth", this.DataStation) 
        }
        else if (this.GraphType == 'temperature'){
          this.create_graph_seasonal("temperature", this.DataStation) 
        }
        else if (this.GraphType == 'precipitation'){
          this.create_graph_seasonal("precipitation", this.DataStation) 
        } 
        else if (this.GraphType == 'hydrograph'){
          this.create_graph_seasonal("hydrograph", this.DataStation) 
        }
        else {
          console.log("type de graphique non valide")
        } 
      }
    }

  /**
  * récupère les données de profondeur d'une station 
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv
  * @param stationID 
  */
  initStationDepth(stationID: string){
    this.jsonService.getDepth(stationID).then((station: dataDepth[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("depth", this.DataStation) 
    });
  }  

  /**
  * Initialise les données de précipitations pour une station donnée.
  * contenus: name(string), id(string), t(string), Q(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID Identifiant de la station
  */
  initStationPrecipitation(stationID: string) {
    this.jsonService.getPrecipitation(stationID).then((station: dataPrecipitation[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("precipitation", this.DataStation) 
    });
  }

  /**
  * Initialise les données de température pour une station donnée.
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID Identifiant de la station sélectionnée
  */
  initStationTemperature(stationID: string){
    this.jsonService.getTemperature(stationID).then((station: dataTemperature[]) => {
      this.DataStation = station; 
      this.create_graph_seasonal("temperature", this.DataStation) 
    });
  }

  /**
  * Initialise les données de débit pour une station donnée.
  * contenus: name(string), id(string), H(string), d(string), t(string)
  * location du fichier origine :backend/data/stations.csv A CHANGER
  * @param stationID L'ID de la station sélectionnée.
  */
  initStationDischarge(stationID: string) {
    this.jsonService.getDischarge(stationID).then((station: dataDischarge[]) => {
      this.DataStation = station;
      this.create_graph_seasonal("hydrograph", this.DataStation) 
    });
  }

   
    /**
 * Traite les données pour les rendre utilisables dans les graphiques, en prenant en compte les précipitations et d'autres types de données.
 * @param typeData Type des données (ex: 'depth', 'discharge', 'precipitation')
 * @param data Tableau des données à traiter (température, décharge, précipitations, etc.)
 * @param targetYears Liste des années à filtrer
 * @returns Un objet contenant les données par jour, par année, et la dernière mise à jour.
 */
processedData(typeData: string, data: any[], targetYears: number[]): { DataByDaily: any[], YearDataByDaily: any[], Update: any } {
    const DataByDaily: any[] = [];
    const YearDataByDaily: any[] = [];
    let Update: number | Date | null = null;
    let uniqueYears: number[] = [];
  
    if (data && data.length > 0) {
        data.forEach(entry => {
            const date = new Date(entry.t);
            const year = date.getFullYear();
            const monthDay = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            const currentDate = new Date(entry.t);
            
            if (!Update || currentDate > Update|| !isNaN(parseFloat(entry.t))) {
              Update = currentDate; 
            }
  
            // Créer l'objet en fonction du type de données
            let newDataEntry: any;
            if (typeData === 'depth') {
                newDataEntry = { H: entry.H, d: entry.d, t: entry.t, years: year, daily: monthDay };
                if (!isNaN(parseFloat(entry.d))) DataByDaily.push(newDataEntry);
            } else if (typeData === 'precipitation') {
                newDataEntry = { Q: entry.Q, t: entry.t, years: year, daily: monthDay };
  
                // Ignorer l'année 1958 et les données invalides
                if (!isNaN(parseFloat(entry.Q)) && year !== 1958) {
                    DataByDaily.push(newDataEntry);
                }
            } else {
                newDataEntry = { Q: entry.Q, t: entry.t, years: year, daily: monthDay };
                if (!isNaN(parseFloat(entry.Q))) DataByDaily.push(newDataEntry);
            }
  
            // Ajouter l'année unique
            if (!uniqueYears.includes(year)) uniqueYears.push(year);
        });
  
        // Si type de données = précipitation, ajouter le cumul journalier des précipitations
        if (typeData === 'precipitation') {
            uniqueYears.forEach(year => {
                const yearData = DataByDaily.filter(entry => entry.years === year);
                let cumulativeRainfall = 0.0;
  
                yearData.forEach(entry => {
                    const rainfall = parseFloat(entry.Q);
                    cumulativeRainfall += rainfall;
                    entry.cumulative_daily_rainfall = cumulativeRainfall;
                });
            });
        }
  
        // Filtrer par années cibles
        DataByDaily.forEach(entry => {
            if (targetYears.includes(entry.years)) YearDataByDaily.push(entry);
        });
    }
  
    return { DataByDaily, YearDataByDaily, Update };
  }

            /**
 * Calcule les quantiles (10%, 50%, 90%) des données fournies, en fonction du type de données.
 * 
 * @param data Tableau des données à traiter.
 * @param dataType Type de données ('depth', 'temperature', 'precipitation', 'hydrograph"').
 * @returns Un objet contenant les quantiles calculés pour chaque jour et les quantiles globaux.
 */
  calculateQuantiles(typeData: string,data: any[]): { resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[], q10: any, q50: any, q90: any } {
    const resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = [];
    let q10: any;
    let q50: any;
    let q90: any;
    // Déterminer la clé de valeur et les années à exclure en fonction du type de données
    let valueKey: string;
    let excludeYears: number[] = [];
  
    switch (typeData) {
      case 'depth':
        valueKey = 'd';
        break;
      case 'hydrograph':
        valueKey = 'Q';
        break;
      case 'temperature':
        valueKey = 'Q';
        break;
      case 'precipitation':
        valueKey = 'cumulative_daily_rainfall';
        break;
      default:
        throw new Error('Invalid data type');
    }
  
    from(data)
      .pipe(
        filter(entry => !isNaN(parseFloat(entry[valueKey]))),
        groupBy(
          entry => entry.daily,
          p => parseFloat(p[valueKey])
        ),
        mergeMap(group => zip(of(group.key), group.pipe(toArray())))
      )
      .subscribe({
        //pour chaque daily 
        next: ([key, values]) => {
          const numericValues: number[] = values.map(value => parseFloat(value.toString())); // Conversion en nombre
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
  
      return { resultArray, q10, q50, q90 };
    }

    create_graph_seasonal(datatype : string, data : any[]) {
      
      const targetYears: number[] = this.yearSelectionChange;
      let titleGraph = null
      let nameYaxis = null
      let hyperlien = null
      let namehyperlien = null
      let hovertemplatename = null
      if(datatype == "depth"){
        titleGraph = 'Profondeur de la nappe [' + data[1] + ']' 
        nameYaxis ='Profondeur [m]'
        hyperlien = `https://ades.eaufrance.fr/Fiche/PtEau?Code=${data[1]}`
        namehyperlien = 'ADES'
        hovertemplatename = 'moyenne: %{y:.1f} m<extra></extra>'
        const  { DataByDaily, YearDataByDaily, Update } = this.processedData('depth', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('depth',this.TabDataByDaily);
        this.resultArray = resultArray;

      }
      else if(datatype == "precipitation") {
        titleGraph = 'Précipitations'
        nameYaxis = 'Cumul des précipitations [mm]'
        hyperlien = "https://meteo.data.gouv.fr/datasets/6569b27598256cc583c917a7"
        namehyperlien = 'Météo France'
        hovertemplatename = 'moyenne: %{y:.1f} mm<extra></extra>'
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('precipitation', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('precipitation', this.TabDataByDaily);
        this.resultArray = resultArray;
      }
       else if (datatype == "temperature"){
        titleGraph = 'Evapotranspiration'
        nameYaxis = 'Evapotranspiration [mm/jour]]'
        hyperlien = "https://meteo.data.gouv.fr/datasets/6569b27598256cc583c917a7"
        namehyperlien = 'Météo France'
        hovertemplatename = 'moyenne: %{y:.1f} mm/jour<extra></extra>'
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('temperature', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('temperature', this.TabDataByDaily);
        this.resultArray = resultArray;
      }
      else if(datatype == "hydrograph"){
        titleGraph = 'Débits de cours d\'eau [' + data[1] + ']'
        nameYaxis = 'Débit de cours d\'eau [m3/s]'
        hyperlien = `https://www.hydro.eaufrance.fr/sitehydro/${data[1]}/fiche`;
        namehyperlien = 'DREAL Bretagne'
        hovertemplatename = '%{y:.3f} m3/s<extra></extra>'
        const  { DataByDaily, YearDataByDaily, Update} = this.processedData('hydrograph', this.DataStation, this.yearSelectionChange);
        this.TabDataByDaily = DataByDaily;
        this.YearTabDataByDaily = YearDataByDaily;
        this.lastUpdate = Update;
        const { resultArray, q10, q50, q90 } = this.calculateQuantiles('hydrograph', this.TabDataByDaily);
        this.resultArray = resultArray;
      }

      const resultArraysKeys = this.resultArray.map(entry => entry.key);
      const variabilityX = resultArraysKeys.concat(resultArraysKeys.slice().reverse());
      const resultArrayq10 = this.resultArray.map(entry => entry.q10);
      const resultArrayq90 = this.resultArray.map(entry => entry.q90);
      const variabilityY =  resultArrayq10.concat(resultArrayq90.slice().reverse());
        
      let max = -Infinity;
      let min = Infinity;
      this.resultArray.forEach(entry => {
          max = Math.max(max, entry.q10 || -Infinity, entry.q90 || -Infinity);
          min = Math.min(min, entry.q10 || Infinity, entry.q90 || Infinity);
      });

                 
      this.fig = {
        data: [],
        layout: {
          title: { 
            text: titleGraph ,
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
        title: nameYaxis, 
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
        ...(datatype === 'depth' && {
          range: [(max + (max * 0.05)), (min - (min * 0.05))]
        }),
        ...(datatype === 'hydrograph' && {
          type: 'log', 
          exponentformat: 'power'
      })
    },
            annotations: [
                {   text: 'Mis à jour le : '+ this.lastUpdate, 
                    showarrow: false, 
                    xref: 'paper', 
                    yref: 'paper', 
                    x: 0.5, 
                    y: 1.15, 
                    font: {
                        "family": "Segoe UI", "size": 14, "color": "#999"
                    } 
                },
                {   text: `<a href="${hyperlien}" style="color:#999; font-family: Segoe UI; font-size: 14px;">Source : ${namehyperlien}</a>`, 
                    showarrow: false, 
                    xref: 'paper', 
                    yref: 'paper', 
                    x: 0.5, 
                    y: -0.20, 
                    font: { 
                        "size":14, "color":"#999", "family":'Segoe UI'
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
        const startYear = this.TabDataByDaily.length > 0 ? this.TabDataByDaily[1].years : 'N/A';
        const endYear = this.TabDataByDaily.length > 0 ? this.TabDataByDaily[this.TabDataByDaily.length - 1].years : 'N/A';
        // Construction du libellé pour la moyenne
        const labelmedian = `moyenne [${startYear} - ${endYear}]`;
        const labelinvariant = `variabilité [${startYear} - ${endYear}]`;
  
    
        // trace median
        this.fig.data.push({
          x: this.resultArray.map(item => item.key),
          y: this.resultArray.map(item => item.q50),
          mode: 'lines',
          name: labelmedian,
          line: { color: 'black', width: 1.5, dash : 'dot' },
          hovertemplate: hovertemplatename,
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

        // Boucle sur les années sélectionnées
        for (let i = 0; i < targetYears.length; i++) {
          const year = targetYears[i];
          const df_event = this.YearTabDataByDaily.filter(item => item.years === year);
          if (df_event) {
            // Choisir la bonne valeur pour y selon dataType
            const yValues = df_event.map(item => 
              datatype === 'depth' ? item.d : 
              datatype === 'precipitation' ? item.cumulative_daily_rainfall : 
              item.Q
            );

            const trace = {
              x: df_event.map(item => item.daily),
              y: yValues,  
              mode: 'lines',
              name: String(year),
              line: { color: this.colorService.getColorForYear(year), width: 1.5 },
              hovertemplate: `${year}: ` + hovertemplatename,
            };
            this.fig.data.push(trace);
          }
        }
      
        // Mettre à jour l'annotation pour afficher la date de mise à jour actuelle
        if (this.lastUpdate){       
          const currentDate = `${this.lastUpdate.getDate().toString().padStart(2, '0')}-${(this.lastUpdate.getMonth() + 1).toString().padStart(2, '0')}-${this.lastUpdate.getFullYear()}`;
          const updatedAnnotation = this.fig.layout.annotations.find((annotation: any) => annotation.text.includes('Mis à jour le :'));
          if (updatedAnnotation) {
            updatedAnnotation.text = `Mis à jour le : ${currentDate}`;
          }
      }
    
        // Tracer la figure Plotly
        //const hydrographWidth = 0.40 * window.innerWidth;
        const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
        const graphWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth;7
        if (this.GraphType == 'depth'){
          Plotlydist.newPlot('depthSeasonal', this.fig.data, this.fig.layout, { responsive: true });
          Plotlydist.relayout('depthSeasonal', { width: graphWidth});
        }
        else if (this.GraphType == 'temperature'){
          Plotlydist.newPlot('temperatureSeasonal', this.fig.data, this.fig.layout, { responsive: true });
          Plotlydist.relayout('temperatureSeasonal', { width: graphWidth});
        }
        else if (this.GraphType == 'precipitation'){
          Plotlydist.newPlot('precipitationSeasonal', this.fig.data, this.fig.layout, { responsive: true });
          Plotlydist.relayout('precipitationSeasonal', { width: graphWidth});
        }
        else if (this.GraphType == 'hydrograph'){
          Plotlydist.newPlot('hydrographSeasonal', this.fig.data, this.fig.layout, { responsive: true });
          Plotlydist.relayout('hydrographSeasonal', { width: graphWidth});
        
        }  
      
      }

      
      downloadCSV(){
            // Initialiser un objet pour stocker les données fusionnées
            const mergedData: { [key: string]: { [year: string]: number | null, q10: number | null ,q50: number | null, q90: number | null} } = {};
            // Initialiser les années présentes dans yearTabDepth
            const years = this.yearSelectionChange;  
            // Ajouter les données de resultArray
            for (const result of this.resultArray) {
                mergedData[result.key] = {
                  q10: result.q10 !== undefined ? result.q10 : null,
                  q50: result.q50 !== undefined ? result.q50 : null,
                  q90: result.q90 !== undefined ? result.q90 : null,
                };
            }
        
            // Ajouter les données de yearTabDepth
            for (const entry of this.YearTabDataByDaily) {
                mergedData[entry.daily][`${entry.years}`] = entry.d;
            }
                                  
              // Initialisation de la chaîne CSV avec l'en-tête initial
              let csv = 'Date,Q90,Q50,Q10';
      
              // Ajouter les années à l'en-tête CSV
              this.yearSelectionChange.forEach(year => {
                  csv += `,${year}`;
              });
      
              // Ajouter une nouvelle ligne pour le CSV
              csv += '\n';
      
              // Parcours de mergedData pour construire le CSV
              Object.keys(mergedData).forEach(date => {
                  // Reformater la date au format souhaité si nécessaire
                  const formattedDate = date; // Assurez-vous de reformater correctement la date si nécessaire
      
                  // Extraire les valeurs q10, q50, q90
                  const q10 = mergedData[date]['q10'] !== null ? mergedData[date]['q10'] : '';
                  const q50 = mergedData[date]['q50'] !== null ? mergedData[date]['q50'] : '';
                  const q90 = mergedData[date]['q90'] !== null ? mergedData[date]['q90'] : '';
      
                  // Construire la ligne CSV pour chaque date
                  let csvLine = `${formattedDate},${q90},${q50},${q10}`;
      
                  // Ajouter les données spécifiques aux années
                  years.forEach(year => {
                      const value = mergedData[date][year] !== null ? mergedData[date][year] : '';
                      csvLine += `,${value}`;
                  });
      
                  // Ajouter une nouvelle ligne pour le CSV
                  csvLine += '\n';
      
                  // Ajouter la ligne au CSV final
                  csv += csvLine;
              });
      
        
                  // Créer le Blob à partir du CSV
                  const blob = new Blob([csv], { type: 'text/csv' });
        
                  // Créer l'URL du Blob
                  const url = window.URL.createObjectURL(blob);
                  let fileName = ''
                  if (this.GraphType == 'depth'){
                    fileName = `profondeur_de_la_nappe[${this.DataStation[1]}].csv`;
                  }
                  else if (this.GraphType == 'precipitation'){
                    fileName = `précipitation.csv`;
                  }
                  else if(this.GraphType == 'hydrograph'){
                    fileName = `debit_seasonal[${this.DataStation[1]}].csv`;
                  }
                  else if(this.GraphType == 'temperature'){
                    fileName = `evapotranspiration.csv`;
                  }
 
        
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