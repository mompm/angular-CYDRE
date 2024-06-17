import { Component, OnInit } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from '../service/json.service';
import { SharedWatershedService } from '../service/shared-watershed.service';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import dataGDFStation from '../model/dataGDFStation';
import {MatDialog} from '@angular/material/dialog';


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
    correspondance: boolean = true;
    currentYear: number = new Date().getFullYear();
    years: number[] = Array.from({length: this.currentYear - 1970 + 1}, (_, i) => 1970 + i);
    selectedYears: number[] = [this.currentYear];
    DataGDFStation: dataGDFStation[]  =[];
    myControl = new FormControl();
    filteredOptions!: Observable<{ index: string, station_name: string }[]>;
    selectedWatershedID: string = '';
    selectedWatershedBSS: string = '';
  
  
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
      const ID =  this.sharedService.getSelectedValue();
      if (ID){
        this.selectedWatershedID =  ID
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
    /**
     * 
     */
    initGDFStations() {
      this.jsonService.getGDFStations().then(data => {
        this.DataGDFStation = data;
        //console.log(this.DataGDFStation);
  
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
      if (select){
        this.selectedWatershedBSS = select;
        this.sharedService.setSelectedValueBSS(select);
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
  }
  /**
   * 
   */
  @Component({
    selector: 'popupDialogFicheSite',
    templateUrl: './popupDialogFicheSite.html',
  })
  export class PopupDialogFicheSite {}
  