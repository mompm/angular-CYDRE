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
     * 
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
     * @param id 
     */
    handleMarkerClick(id: string): void {
      console.log(`ID du marker dans le composant parent : ${id}`);
      const selectedOption = this.DataGDFStation.find(station => station.index === id);
      if (selectedOption) {
        this.myControl.setValue(selectedOption);
        this.selectedWatershedID = selectedOption.index;
        this.sharedService.setSelectedValue(selectedOption.index);
        if(this.list_of_disabled_options.includes(selectedOption.index)){
          this.correspondance = false;
        }
        else{
          this.correspondance = true;
        }
        this.selectedWatershedBSS = selectedOption.BSS_ID;
        this.sharedService.setSelectedValueBSS(selectedOption.BSS_ID);
        }
      
    }
    /**
     * 
     */
    openDialog() {
      this.dialog.open(PopupDialogFicheSite);
    }

    openDialogLoc() {
      this.dialog.open(PopupDialogLoc);
    }

    openDialogClassif(event: MouseEvent) {
      const targetElement = event.target as HTMLElement;
      const rect = targetElement.getBoundingClientRect(); // Récupère la position du bouton

      console.log('Position du bouton :', rect);

      this.dialog.open(popupDialogClassif, {
        width: '400px',   // Largeur de la fenêtre
        maxHeight: '80vh', // Limite la hauteur pour éviter qu'elle déborde
        panelClass: 'custom-dialog-container', // Classe personnalisée pour ajuster les styles
        hasBackdrop: true,
        backdropClass: 'custom-backdrop', // Ajout de la classe backdrop personnalisée
        autoFocus: true,
        position: {
          top: `${rect.bottom - 50}px`, // 10px en dessous du bouton
          left: `${rect.right + 20}px`,   // 5px à droite du bouton
          right: 'auto',                 // Laisser l'alignement horizontal au contenu
          bottom: 'auto'  
        }
      });
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
     * @param value 
     * @returns 
     */
    private _filter(value: string): { index: string, station_name: string }[] {
      value = value.toString()
      const filterValue = value.toLowerCase();
  
      return this.DataGDFStation
        .filter(station =>
          station.index.toLowerCase().includes(filterValue) ||
          station.station_name.toLowerCase().includes(filterValue)
        )
        .map(station => ({ index: station.index, station_name: station.station_name }));
    }
    /**
     * 
     * @param event 
     */
    onOptionSelected(event: any) {
      const selectedOption = event.option.value;
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
      if (this.list_of_disabled_options.includes(selectedOption.index)){
        this.correspondance = false;
      }
      else{
        this.correspondance = true;
      }
      //console.log('Selected Value:', this.selectedWatershedID, this.selectedWatershedBSS);
    }
  
    /**
     * 
     * @param option 
     * @returns 
     */
    isOptionDisabled(option: { index: string, station_name: string }): boolean {
      return this.list_of_disabled_options.includes(option.index);
    }
    /**
     * 
     * @param option 
     * @returns 
     */
    displayFn(option: { index: string, station_name: string }): string {
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
   * 
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