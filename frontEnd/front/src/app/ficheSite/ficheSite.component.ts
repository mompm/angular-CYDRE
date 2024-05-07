import { Component, SimpleChanges} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from 'src/app/service/data.service';
import * as Plotlydist from 'plotly.js-dist';
import { Layout ,AxisType} from 'plotly.js-dist';
import OldBSSData from '../model/OldBSSData';
import CorrespondancesBSSData from '../model/CorrespondanceBSSData';
import StationDischargedata from '../model/StationDischargedata';
import GDFPiezometryData from '../model/GDFPiezometryData ';
import GDFStationData from '../model/GDFStationData';

@Component({
    selector: 'app-fiche-site',
    templateUrl: './ficheSite.component.html',
    styleUrls: ['./ficheSite.component.scss']
  })

  export class FicheSiteComponent {
    isDialogOpen: boolean = false;

    selectedStationID: string = 'J0014010';
    selectedOldBSS :string = '02478X0156/PZ';
    OdlBSSs: OldBSSData[] = [];
    CorrespondanceBSSs: CorrespondancesBSSData[] = [];
    isAdesVisible: boolean = true;
    stationMap:string = '';
    dischargeStation: StationDischargedata[] = [];
    currentYear: number = new Date().getFullYear();
    years: number[] = Array.from({length: this.currentYear - 1970 + 1}, (_, i) => 1970 + i);
    selectedYears: number[] = [this.currentYear];
    GDFPiezometryDatas: GDFPiezometryData [] = [];
    GDFStationDatas: GDFStationData[]  =[];
  


  constructor(private dataService: DataService, private dialog: MatDialog) {}
    //fonction activé lors init du component ficheSite
    ngOnInit() {
      //la plupart des fonctions récupères des donnée en backend (à changer pour les mettre au démarrage de app)
      //this.stationSelectionChange.emit(this.selectedStationID);
      this.stationMap = 'J0014010';
      this.initCorrespondanceBSS();
      this.initOldBSS(); 
      this.initStationDischarge(this.selectedStationID);
      this.initGDFStations();
    }

    // affiche le popup du bouton info
    toggleDialog(): void {
      this.isDialogOpen = !this.isDialogOpen;
    }

    //récupère les données des gdf des stations
    //contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
    //contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
    //contenus dans geometry: coordinates et type  
    //location du fichier origine :backend/data/stations.csv
    initGDFStations() {
      this.dataService.getMesurementGDFStation().then(data => {
        this.GDFStationDatas = data;  
        console.log(this.GDFStationDatas);
      });
    }


    initStationDischarge(stationID: string){
      this.dataService.getMesurementStationDischarge(stationID).then(station => {
        this.dischargeStation = station;
        //const dfYear = this.dischargeStation.filter(data => new Date(data['t']).getFullYear() === 2024);
        //console.log(dfYear);
        this.processDischargeData()
      });
    }

    processDischargeData() {
      const targetYears: number[] = [2024];
      const processedData = [];
      const linesByYear = [];
    
      // Vérification si this.dischargeStation est défini et non vide
      if (this.dischargeStation && this.dischargeStation.length > 0) {
        // Parcourir les données et traiter chaque entrée
        for (const entry of this.dischargeStation) {
          const year = new Date(entry.t).getFullYear(); // Récupérer l'année de la date
          const month = new Date(entry.t).getMonth() + 1; // Récupérer le mois de la date
          const day = new Date(entry.t).getDate(); // Récupérer le jour de la date
    
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
          processedData.push(newDataEntry);

          if (targetYears.includes(year)) {
            linesByYear.push(entry);
          }
        }
      } else {
        console.error("No data available in this.dischargeStation.");
      }
      console.log(linesByYear);
      //console.log(processedData)
    }


    //récupère les données oldBSS
    //contenus : X_WGS84(string), Y_WGS84(string), Identifiant_BSS(string), Ancien_code_national_BSS(string)
    //format coordonées dans  X_WGS84 et Y_WGS84 : wgs84
    //location du fichier origine : backend/data/piezometry/stations.csv 
    initOldBSS(){
      this.dataService.getMesurementOldBSS().then(old => {
        this.OdlBSSs = old;
      });
    }

    //récupère les données des correspondance stations et piezomètres 
    //contenus: NOM_BV (string), ID_HYDRO (string),CODE_BSS (string), TEMPS_RECESS(string)
    //location du fichier origine : backend/data/piezometry/correspondance_watershed_piezometers.csv
    initCorrespondanceBSS(){
      this.dataService.getMesurementCorrespondanceBSS().then(correspondance => {
        this.CorrespondanceBSSs = correspondance;
      });
    }
    
    // fonction actioné avec le dropdown , il active les fonctions qui sont modifié dans ce cas
    onStationSelectionChange(stationID: string) {
      console.log('Nouvelle station sélectionnée:', stationID);
      this.stationMap = stationID;
      this.ChangeBSS(stationID);
  
    }

    // Donne old BSS code pour le bouton Ades sinon il rend le bouton invisible 
    ChangeBSS(stationID: string){
      // Recherche de ID correspondant dans le tableau correspondance
      const selectedCorrespondance = this.CorrespondanceBSSs.find(CorrespondanceBSS => CorrespondanceBSS.ID_HYDRO === stationID);
    
      // Vérification si l'élément a été trouvé
      if (selectedCorrespondance) {
        console.log(selectedCorrespondance)
        // Recherche de ID BSS correspondant dans le tableau OldBSS
        const selectedOdlBSS = this.OdlBSSs.find(old => old.Identifiant_BSS === selectedCorrespondance.CODE_BSS);
          if(selectedOdlBSS){
            //garde en mémoire le code old BSS
            this.selectedOldBSS = selectedOdlBSS.Ancien_code_national_BSS;
            //rend visible le bouton Ades (condition  *ngIf du bouton)
            this.isAdesVisible = true;
            console.log('old bss: ', selectedOdlBSS.Ancien_code_national_BSS);
          }
          else{
            //rend invivisble le bouton Ades ( condition  *ngIf du bouton)
            this.isAdesVisible = false;
            console.log('Aucun identifiant_BSS trouvé pour la station sélectionnée.');
          }
      } else {
        //sécurité pour la condition visible/invisble bouton Ades
        this.isAdesVisible = false;
        console.log('Aucune correspondance trouvé pour la station sélectionnée.');
      }
    }
}