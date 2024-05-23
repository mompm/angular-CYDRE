import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { SharedWatershedService } from '../service/shared-watershed.service';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import GDFStationData from '../model/GDFStationData';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';


@Component({
  selector: 'app-Simulateur',
  templateUrl: './Simulateur.component.html',
  styleUrls: ['./Simulateur.component.scss']
})
export class Simulateur implements OnInit {
  myControl = new FormControl();
  filteredOptions!: Observable<{ index: string, station_name: string }[]>;
  GDFStationDatas: GDFStationData[] = [];
  selectedWatershedID: string | null | undefined;
  selectedWatershedBSS: string | null | undefined;


  // Liste des options désactivées
  list_of_disabled_options: string[] = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120',
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
  ];

  constructor(private dataService: DataService, private sharedService : SharedWatershedService, public dialog : MatDialog) { }

  ngOnInit() {
    this.initGDFStations();
    this.selectedWatershedID = this.sharedService.getSelectedValue();
    this.selectedWatershedBSS =this.sharedService.getSelectedValueBSS();
    console.log('Selected Value:', this.selectedWatershedID, this.selectedWatershedBSS);
  }
  openDialog() {
    this.dialog.open(PopupDialog);
  }


  initGDFStations() {
    this.dataService.getMesurementGDFStation().then(data => {
      this.GDFStationDatas = data;
      //console.log(this.GDFStationDatas);

      // Initialise `filteredOptions` après avoir chargé les données
      this.filteredOptions = this.myControl.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '')),
      );

      // Définir la valeur initiale de l'input
      const initialOption = this.GDFStationDatas.find(station => station.index === this.sharedService.getSelectedValue());
      //this.selectedWatershed = this.sharedService.getSelectedValue();
      if (initialOption) {
        this.myControl.setValue(initialOption);
      }
    });
  }

  private _filter(value: string): { index: string, station_name: string }[] {
    value = value.toString()
    const filterValue = value.toLowerCase();

    return this.GDFStationDatas
      .filter(station =>
        station.index.toLowerCase().includes(filterValue) ||
        station.station_name.toLowerCase().includes(filterValue)
      )
      .map(station => ({ index: station.index, station_name: station.station_name }));
  }

  onOptionSelected(event: any) {
    const selectedOption = event.option.value;
    this.sharedService.setSelectedValue(selectedOption.index);
    this.selectedWatershedID = selectedOption.index;
    const select = this.GDFStationDatas.find(station => station.index === selectedOption.index)?.BSS_ID;
    if (select){
      this.selectedWatershedBSS = select;
      this.sharedService.setSelectedValueBSS(select);
    }
    console.log('Selected Value:', this.selectedWatershedID, this.selectedWatershedBSS);
  }

  isOptionDisabled(option: { index: string, station_name: string }): boolean {
    return this.list_of_disabled_options.includes(option.index);
  }

  displayFn(option: { index: string, station_name: string }): string {
    return option ? `${option.index} - ${option.station_name}` : '';
  }

  showDialogIfDisabled() {
    const selectedOption = this.myControl.value;
    if (this.isOptionDisabled(selectedOption)) {
      this.dialog.open(StationUnavailableDialog);
    } else {
      this.sharedService.setSelectedValue(selectedOption.index);
      console.log('Selected Value:', this.selectedWatershedID, this.selectedWatershedBSS);
    }
  }
}

@Component({
  selector: 'popupDialog',
  templateUrl: './popupDialog.html',
})
export class PopupDialog {}

@Component({
  selector: 'stationUnavailableDialog',
  templateUrl: './stationUnavailableDialog.html',
})
export class StationUnavailableDialog {}
