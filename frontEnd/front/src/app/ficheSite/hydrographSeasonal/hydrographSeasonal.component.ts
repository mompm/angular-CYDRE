import { Component, Input, SimpleChanges, OnDestroy, HostListener } from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import { median } from 'simple-statistics';
import * as math from 'mathjs';
import { from, of, zip } from 'rxjs';
import { filter, groupBy, mergeMap, toArray } from 'rxjs/operators';
import dataDischarge from 'src/app/model/dataDischarge';
import { ColorService } from 'src/app/service/color-service.service';


/**
 * Le composant hydrographSeasonal affiche un hydrographe saisonnier basé sur les données de décharge d'eau.
 */
@Component({
  selector: 'app-hydrographSeasonal',
  templateUrl: './hydrographSeasonal.component.html',
  styleUrls: ['./hydrographSeasonal.component.scss']
})
export class hydrographSeasonal implements OnDestroy{
  private resizeListener: () => void; // permet de mettre à jour la taille du graphique 
  @Input() stationSelectionChange!: string; // ID de la station sélectionnée. L'hydrographe change en fonction de cette sélection.
  @Input() yearSelectionChange!: number[];  // Liste des années sélectionnées pour l'affichage. L'hydrographe inclut les données pour ces années.
  Datadischarge: dataDischarge[] = []; // Tableau pour stocker les données de décharge.
  fig: any; // Objet pour stocker la figure Plotly.
  months: string[] = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]; // Noms des mois.
  tickvals: string[] = this.months.map((month, index) => `${index + 1 < 10 ? '0' : ''}${index + 1}-01`); // Valeurs des ticks pour l'axe des x.
  ticktext: string[] = this.months.map(month => month); // Textes des ticks pour l'axe des x.
  TabDischargeByDaily: any[] = []; //tableau contenant toutes les données discharge triés
  YearTabDischargeByDaily: any[] = []; //tableau contenant les données discharge triés des années selectionné
  lastUpdate: any | null;// dernière update des données des données discharge
  resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = []; // tableau contenant les quantiles 
  
  /**
   * Constructeur de la classe hydrographSeasonal.
   * @param dataService Service pour gérer les données.
   * @param jsonService Service pour gérer les opérations JSON.
   */
  constructor(private dataService: DataService, private jsonService: JsonService, private colorService : ColorService) {
    this.resizeListener = () => {
      const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
      const hydrographWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth;
      Plotlydist.relayout('plotlyDiv', { width: hydrographWidth });
    }
  }
  
  // You should add the resize event listener to call the resizeListener method when the window is resized
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeListener();
  }

  /**
   * Initialisation du composant. Appelée une fois que le composant est initialisé.
   */
  ngOnInit() {
    window.addEventListener('resize', this.resizeListener);
    this.initStationDischarge(this.stationSelectionChange);
  }

  ngOnDestroy(){
    window.removeEventListener('resize',this.resizeListener);
  }

  /**
   * Méthode appelée à chaque changement des propriétés @Input.
   * @param changes Objet contenant les changements des propriétés.
   */
  ngOnChanges(changes: SimpleChanges) {
    // Si le changement concerne la station sélectionnée, recharger les données de décharge pour la nouvelle station.
    if (changes['stationSelectionChange']) {
      this.initStationDischarge(changes['stationSelectionChange'].currentValue);
    } 
    // Si le changement concerne les années sélectionnées, mettre à jour l'hydrographe saisonnier.
    else if (changes['yearSelectionChange']) {
      this.hydrograph_Seasonal();
    }
  }

  /**
   * Initialise les données de décharge pour une station donnée.
   * @param stationID ID de la station pour laquelle les données de décharge doivent être chargées.
   */
  initStationDischarge(stationID: string) {
    this.jsonService.getDischarge(stationID).then(station => {
      this.Datadischarge = station;
      this.hydrograph_Seasonal();
    });
  }

  /**
   * Traite les données de décharge pour les rendre utilisables par l'hydrographe.
   * @returns Un objet contenant les données de décharge quotidiennes et par année, ainsi que la dernière mise à jour.
   */
  processedDischarge(): { DischargeByDaily: any[], YearDischargeByDaily: any[], Update: any } {
    const targetYears: number[] = this.yearSelectionChange;
    const DischargeByDaily: any[] = [];
    const YearDischargeByDaily: any[] = [];
    let Update = null;

    // Vérification si this.Datadischarge est défini et non vide
    if (this.Datadischarge && this.Datadischarge.length > 0) {
      for (const entry of this.Datadischarge) {
        const year = new Date(entry.t).getFullYear(); // Récupérer l'année de la date
        const month = new Date(entry.t).getMonth() + 1; // Récupérer le mois de la date
        const day = new Date(entry.t).getDate(); // Récupérer le jour de la date
        const currentDate = new Date(entry.t);

        if (!Update || currentDate > Update || !isNaN(parseFloat(entry.t))) {
          Update = currentDate; 
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
          DischargeByDaily.push(newDataEntry);
        }

        if (targetYears.includes(year)) {
          YearDischargeByDaily.push(newDataEntry);
        }
      }
    } 

    return { DischargeByDaily, YearDischargeByDaily, Update };
  }

  /**
   * Calcule les quantiles (10ème, 50ème, et 90ème) des données de décharge.
   * @param DischargeByDaily Tableau des données de décharge quotidiennes.
   * @returns Un objet contenant les quantiles calculés et les données groupées par jour.
   */
  calculateQuantiles(DischargeByDaily: any[]): { resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[], q10: any, q50: any, q90: any } {
    const resultArray: { key: string; values: number[]; q10?: number; q50?: number; q90?: number; }[] = [];
    let q10: any;
    let q50: any;
    let q90: any;

    from(DischargeByDaily)
      .pipe(
        filter(entry => !isNaN(parseFloat(entry.Q))),
        groupBy(
          entry => entry.daily,
          p => p.Q
        ),
        mergeMap(group => zip(of(group.key), group.pipe(toArray())))
      )
      .subscribe({
        // Pour chaque jour, calculer les quantiles et la médiane
        next: ([key, values]) => {
          const numericValues: number[] = values.map(value => parseFloat(value));
          // Calcule les quantiles et médiane
          q10 = (math.quantileSeq(numericValues, 0.1));
          // Arrondi à 4 chiffres après la virgule
          q10 = parseFloat(q10.toFixed(4));
          q50 = median(numericValues);
          q50 = parseFloat(q50.toFixed(4));
          q90 = math.quantileSeq(numericValues, 0.9);
          q90 = parseFloat(q90.toFixed(4));
          // Ajouter les résultats au tableau
          const entry = { key, values: numericValues, q10, q50, q90 };
          resultArray.push(entry);
        }
      });

    // Trier les résultats par date (mois-jour)
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

  /**
   * Met à jour et affiche l'hydrographe saisonnier avec les données actuelles.
   */
  hydrograph_Seasonal() {
    const hyperlien = `https://www.hydro.eaufrance.fr/sitehydro/${this.Datadischarge[1]}/fiche`;
    const targetYears: number[] = this.yearSelectionChange;
    const {DischargeByDaily, YearDischargeByDaily, Update }= this.processedDischarge();
    this.TabDischargeByDaily = DischargeByDaily;
    this.YearTabDischargeByDaily = YearDischargeByDaily;
    this.lastUpdate = Update
    const { resultArray, q10, q50, q90 } = this.calculateQuantiles(this.TabDischargeByDaily);
    this.resultArray = resultArray;

    const resultArraysKeys = resultArray.map(entry => entry.key);
    const variabilityX = resultArraysKeys.concat(resultArraysKeys.slice().reverse());
    const resultArrayq10 = resultArray.map(entry => entry.q10);
    const resultArrayq90 = resultArray.map(entry => entry.q90);
    const variabilityY = resultArrayq10.concat(resultArrayq90.slice().reverse());

    this.fig = {
      data: [],
      layout: {
        title: { text: 'Débits de cours d\'eau [' + this.Datadischarge[1] + ']', font: { family: "Segoe UI Semibold", size: 22, color: "black" } },
        xaxis: { type: 'category', 'tickvals': this.tickvals, 'ticktext': this.ticktext, tickfont: { size: 14, family: 'Segoe UI Semibold', color: 'black' }, 'gridwidth': 0.01, 'gridcolor': 'rgba(0,0,0,0.1)' },
        yaxis: { title: 'Débit de cours d\'eau [m3/s]', type: 'log', exponentformat: 'power', tickfont: { size: 14, family: 'Segoe UI Semibold', color: 'black' }, showticklabels: true, gridwidth: 0.01, gridcolor: 'rgba(0,0,0,0.1)' },

        annotations: [
          { text: 'Mis à jour le : DATE', 
            showarrow: false, 
            xref: 'paper', 
            yref: 'paper',
            x: 0.5, 
            y: 1.15, 
            font: { "family": "Segoe UI", "size": 14, "color": "#999" } 
          },
          { text: `<a href="${hyperlien}" style="color:#999; font-family: Segoe UI; font-size: 14px;;">Source : DREAL Bretagne</a>`,  
            showarrow: false, 
            xref: 'paper', 
            yref: 'paper', 
            x: 0.5, 
            y: -0.20, 
            font: { "size":14, "color":"#999", "family":'Segoe UI' } }
        ],
        margin: { t: 125 },
        title_x: 0.5,
        hovermode: "x unified",
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "rgba(0,0,0,0)",
        legend: { orientation: "h", yanchor: "top", y: 1.1, xanchor: "right", x: 1 }
      }
    };

    const startYear = this.TabDischargeByDaily.length > 0 ? this.TabDischargeByDaily[1].years : 'N/A';
    const endYear = this.TabDischargeByDaily.length > 0 ? this.TabDischargeByDaily[this.TabDischargeByDaily.length - 1].years : 'N/A';
    // Construction du libellé pour la moyenne
    const labelmedian = `moyenne [${startYear} - ${endYear}]`;
    const labelinvariant = `variabilité [${startYear} - ${endYear}]`;

    // Trace de la médiane
    this.fig.data.push({
      x: resultArray.map(item => item.key),
      y: resultArray.map(item => item.q50),
      mode: 'lines',
      name: labelmedian,
      line: { color: 'black', width: 1.5, dash: 'dot' },
      hovertemplate: 'moyenne: %{y:.3f} m3/s<extra></extra>',
    });

    // Trace de l'invariant
    this.fig.data.push({
      x: variabilityX,
      y: variabilityY,
      fill: 'tozeroy',
      fillcolor: 'rgba(183, 223, 255, 0.3)',
      mode: 'none',
      name: labelinvariant,
      hoverinfo: 'none'
    });

    // Boucle sur les événements
    for (let i = 0; i < targetYears.length; i++) {
      const year = targetYears[i];
      const df_event = this.YearTabDischargeByDaily.filter(item => item.years === year);
      if (df_event) {
        const trace = {
          x: df_event.map(item => item.daily),
          y: df_event.map(item => item.Q),
          mode: 'lines',
          name: String(year),
          line: {
            color: this.colorService.getColorForYear(year), 
            width: 1.5
          },
          hovertemplate: `${year}: %{y:.3f} m3/s<extra></extra>`,
        };
        this.fig.data.push(trace); // Ajouter la trace à this.fig.data
      }
    }

    // Mettre à jour l'annotation pour afficher la date de mise à jour actuelle
   
      const currentDate = `${this.lastUpdate.getDate().toString().padStart(2, '0')}-${(this.lastUpdate.getMonth() + 1).toString().padStart(2, '0')}-${this.lastUpdate.getFullYear()}`;
      const updatedAnnotation = this.fig.layout.annotations.find((annotation: any) => annotation.text.includes('Mis à jour le :'));
      if (updatedAnnotation) {
        updatedAnnotation.text = `Mis à jour le : ${currentDate}`;
      }
    

    // Tracer la figure Plotly
    //const hydrographWidth = 0.40 * window.innerWidth;
    const isSmallScreen = window.matchMedia("(max-width: 1000px)").matches;
    const hydrographWidth = isSmallScreen ? 0.80 * window.innerWidth : 0.40 * window.innerWidth;
    Plotlydist.newPlot('plotlyDiv', this.fig.data, this.fig.layout, { responsive: true });
    Plotlydist.relayout('plotlyDiv', { width: hydrographWidth });
    
  }
  

  downloadCSV(){
      // Initialiser un objet pour stocker les données fusionnées
      const mergedData: { [key: string]: { [year: string]: number | null, q10: number | null ,q50: number | null, q90: number | null} } = {};
      // Initialiser les années présentes dans yearTabDischarge
      const years = this.yearSelectionChange;  
      // Ajouter les données de resultArray
      for (const result of this.resultArray) {
          mergedData[result.key] = {
            q10: result.q10 !== undefined ? result.q10 : null,
            q50: result.q50 !== undefined ? result.q50 : null,
            q90: result.q90 !== undefined ? result.q90 : null,
          };
      }
  
      // Ajouter les données de yearTabDischarge
      for (const entry of this.YearTabDischargeByDaily) {
          mergedData[entry.daily][`${entry.years}`] = entry.Q;
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

            const fileName = `debit_seasonal[${this.Datadischarge[1]}].csv`;
  
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
