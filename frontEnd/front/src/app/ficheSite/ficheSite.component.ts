import { Component, OnInit, SimpleChanges } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import * as L from 'leaflet';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from '../service/json.service';
import { SharedWatershedService } from '../service/shared-watershed.service';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import dataGDFStation from '../model/dataGDFStation';
import {MatDialog} from '@angular/material/dialog';
import dataGDFWatersheds from '../model/dataGDFWatersheds';
import * as Plotly from 'plotly.js-dist';



/**
 * 
 */
@Component({
    selector: 'app-fiche-site',
    templateUrl: './ficheSite.component.html',
    styleUrls: ['./ficheSite.component.scss']
  })

  /**
   * 
   */
  export class FicheSiteComponent {
    private mapy!: L.Map;
    mapInit: boolean = true;
    correspondance: boolean = true;
    currentYear: number = new Date().getFullYear();
    years: number[] = Array.from({length: this.currentYear - 1970 + 1}, (_, i) => 1970 + i);
    selectedYears: number[] = [this.currentYear];
    DataGDFStation: dataGDFStation[]  =[];
    DataGDFWatershed : dataGDFWatersheds[] = [];
    myControl = new FormControl();
    filteredOptions!: Observable<{ index: string, station_name: string }[]>;
    selectedWatershedID: string  = '';
    selectedStationName: string = '';
    selectedWatershedBSS: string  ='';

  
  
    // Liste des options désactivées
    list_of_disabled_options: string[] = [
      'J0121510', 'J0621610', 'J2233010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
      'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210','J7373110', 'J8433010', 'J8502310',    
    ];
    /**
     * 
     * @param dataService 
     * @param jsonService 
     * @param sharedService 
     * @param dialog 
     */
    constructor(private dataService: DataService,private jsonService: JsonService, private sharedService : SharedWatershedService, public dialog : MatDialog) { }
    /**
     * fonction actionnée au démarrage de la fiche de site 
     * récupère les données et met a jour ( si besoin ) les données dans sharedService
     */
    ngOnInit() {
      this.initGDFStations();
      this.initGDFWatersheds();
      const ID =  this.sharedService.getSelectedValue();
      if (ID){
        this.selectedWatershedID =  ID
      }
      const NAME = this.sharedService.getSelectedStationName();
      if( NAME){
        this.selectedStationName = NAME;
      }
      const BSS = this.sharedService.getSelectedValueBSS();
      if (BSS){
        this.selectedWatershedBSS = BSS
      }
    }

    /**
     * 
     */
        initGDFStations() {
          this.jsonService.getGDFStations().then(data => {
            this.DataGDFStation = data;
            // Initialise `filteredOptions` après avoir chargé les données
            this.filteredOptions = this.myControl.valueChanges.pipe(
              startWith(''),
              map(value => this._filter(value || '')),
            );
            // Définir la valeur initiale de l'input
            const initialOption = this.DataGDFStation.find(station => station.index === this.sharedService.getSelectedValue());
            //this.selectedWatershed = this.sharedService.getSelectedValue();
            if (initialOption) {
              this.myControl.setValue(initialOption);
            }
          });
        }

    /**
     * 
     */    
    initGDFWatersheds() {
      this.jsonService.getGDFWatersheds().then(data => {
        this.DataGDFWatershed = data;
      });
    }
    /**
    * Gère le clic sur un marqueur dans la carte.
    * Recherche la station correspondant à l'ID donné dans `DataGDFStation` 
    * et met à jour la sélection du dropdown ainsi que les données dans sharedService.
    * @param id récupèrer sur le marqueur
    */
    handleMarkerClick(id: string): void {
      console.log(`ID du marker dans le composant parent : ${id}`);
      // Récupère les données de la station sélectionner
      const selectedOption = this.DataGDFStation.find(station => station.index === id);
      // si elle existe met à jour la sélection du dropdown ainsi que les données dans sharedService
      if (selectedOption) {
        // mise à jour sélection du dropdown
        this.myControl.setValue(selectedOption);
        // mise à jour les données dans sharedService
        this.selectedWatershedID = selectedOption.index;
        this.sharedService.setSelectedValue(selectedOption.index);
        this.selectedWatershedBSS = selectedOption.BSS_ID;
        this.sharedService.setSelectedValueBSS(selectedOption.BSS_ID);
        // vérifie  si elle la liste est dans la liste des options non implémenté(le bouton ADE n'est pas affiché)
        if(this.list_of_disabled_options.includes(selectedOption.index)){
          this.correspondance = false;
        }
        else{
          this.correspondance = true;
        }
      }
    }

    /**
     * Filtre les options de stations en fonction de la valeur saisie par l'utilisateur dans le dropdown.
     * La fonction cherche les stations dont l'index ou le nom contient la chaîne de caractères fournie.
     *
     * @param value - La chaîne de caractères entrée par l'utilisateur dans le champ de recherche du dropdown.
     * @returns Un tableau d'objets contenant l'index et le nom des stations correspondant au critère de recherche.
     */
    private _filter(value: string): { index: string, station_name: string }[] {
      // Convertit la valeur entrée en chaîne de caractères pour éviter les erreurs
      value = value.toString()
      // Transforme la valeur en minuscules pour éviter des erreurs
      const filterValue = value.toLowerCase();
       // Filtre les stations dont l'index ou le nom de station contient la valeur filtrée
      return this.DataGDFStation
        .filter(station =>
          station.index.toLowerCase().includes(filterValue) ||
          station.station_name.toLowerCase().includes(filterValue)
        )
         // Retourne un tableau d'objets avec l'index et le nom de la station correspondante
        .map(station => ({ index: station.index, station_name: station.station_name }));
    }

    /**
     * Gère la sélection d'une option dans le dropdown.
     * Met à jour les valeurs sélectionnées et les enregistre dans le service partagé.
     *
     * @param event - L'événement de sélection déclenché par l'utilisateur lors du choix d'une option dans le dropdown.
     */
    onOptionSelected(event: any) {
      // Récupère l'option sélectionnée à partir de l'événement
      const selectedOption = event.option.value;
      // mise à jour les données de sharedService
      this.sharedService.setSelectedValue(selectedOption.index);
      this.selectedWatershedID = selectedOption.index;
      const select = this.DataGDFStation.find(station => station.index === selectedOption.index)?.BSS_ID;
      const name = this.DataGDFStation.find(station => station.index === selectedOption.index)?.name;
      if (select){
        this.selectedWatershedBSS = select;
        this.sharedService.setSelectedValueBSS(select);
      }
      if (name){
        this.selectedStationName = name;
        this.sharedService.setSelectedStationName(name);
      }
      // Vérifie si l'option sélectionnée est désactivée dans la liste des options
      if (this.list_of_disabled_options.includes(selectedOption.index)){
        this.correspondance = false;
      }
      else{
        this.correspondance = true;
      }
    }

    /**
     * Vérifie si une option du dropdown est désactivée.
     * Une option est désactivée si son index figure dans `list_of_disabled_options`.
     *
     * @param option - L'option à vérifier, contenant l'index et le nom de la station.
     * @returns `true` si l'option est désactivée, sinon `false`.
     */
    isOptionDisabled(option: { index: string, station_name: string }): boolean {
      // Retourne true si l'index de l'option figure dans la liste des options désactivées
      return this.list_of_disabled_options.includes(option.index);
    }

    /**
     * Définit la manière dont les options sont affichées dans le dropdown.
     * Concatène l'index et le nom de la station pour afficher une chaîne de caractères lisible.
     *
     * @param option - L'option à afficher, contenant l'index et le nom de la station.
     * @returns Une chaîne de caractères formatée pour être affichée dans le dropdown.
     */
    displayFn(option: { index: string, station_name: string }): string {
    // Si une option est sélectionnée, retourne une chaîne formatée "index - station_name"
      return option ? `${option.index} - ${option.station_name}` : '';
    }

    initGDFWatersheds() {
      this.jsonService.getGDFWatersheds().then(data => {
        this.DataGDFWatershed = data;
      });
    }



//  // Ajout de la légende dans la div HTML
//  const legendItemsContainer = document.getElementById('legend-items');
//  if (legendItemsContainer) {
//    const grades = Object.keys(colors) as unknown as (keyof typeof colors)[];
//    console.log(grades);
//    grades.forEach(grade => {
//      const legendItem = document.createElement('div');
//      legendItem.className = 'legend-item';
//      legendItem.innerHTML = `
//         <div style ="display: flex; align-items: center;">
//        <div style="width: 10px; height: 10px; background-color:${colors[grade]}; border-radius: 50%; margin-right: 10px"></div>
//        <div>${typologyNames[grade]}</div>
//        </div>
//      `;
//      legendItemsContainer.appendChild(legendItem);
//    });
//  }
}

  // }
  /**
   * component des popup présent sur la fiche de Site 
   */
  @Component({
    selector: 'popupDialogFicheSite',
    templateUrl: './popupDialogFicheSite.html',
  })
  export class PopupDialogFicheSite {}
  
  @Component({
    selector: 'popupDialogLoc',
    templateUrl : './popupDialogLoc.html',
  })
  export class PopupDialogLoc {}

  @Component({
    selector: 'popupDialogClassif',
    templateUrl : './popupDialogClassif.html',
  })
  export class popupDialogClassif {}