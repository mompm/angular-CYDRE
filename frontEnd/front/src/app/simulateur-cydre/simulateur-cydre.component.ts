import { Component, OnInit } from '@angular/core';
import { Options } from '@angular-slider/ngx-slider';
import { JsonService } from '../service/json.service';
import { HttpClient } from '@angular/common/http';
import { SharedWatershedService } from '../service/shared-watershed.service';
import { FormControl } from '@angular/forms';
import { Observable, map, startWith } from 'rxjs';
import { DataService } from '../service/data.service';



@Component({
  selector: 'app-simulateur-cydre',
  templateUrl: './simulateur-cydre.component.html',
  styleUrls: ['./simulateur-cydre.component.scss']
})
export class SimulateurCydreComponent implements OnInit {

  constructor(private jsonService: JsonService, private http: HttpClient, private sharedService : SharedWatershedService, private dataService: DataService) { }
  myControl = new FormControl();
  filteredOptions!: Observable<{ index: string, station_name: string }[]>;
  progressMessages: string[] = [];
  progressValue = 0;
  currentProgressMessage = '';
  stations: any[] = [];
  selectedStation: string | null | undefined;
  selectedStationName: string | null | undefined;
  sliderValue: number = 60;
  simulationDate: string = new Date().toISOString().split('T')[0];
  isModalOpen: boolean = false;
  
  list_of_disabled_options: string[] = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120',
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
  ];


  simulationResults: any = null;
  results: any = {};
  taskId: string | undefined;
  showResults :boolean = false;

  sliderOptions: Options = {
    floor: 0,
    ceil: 120,
    step: 1, // Permet de sélectionner chaque valeur
    showTicks: true, // Affiche les traits pour chaque valeur principale
    showTicksValues: true, // Affiche les valeurs des points principaux
    ticksArray: [0, 20, 40, 60, 80, 100, 120], // Spécifiez les emplacements des gros points
    translate: (value: number): string => {
      return value.toString();
    }
};

  ngOnInit() {
    this.initGDFStations();
    this.selectedStation = this.sharedService.getSelectedValue();
    this.selectedStationName =this.sharedService.getSelectedValueBSS();
    console.log('Selected Value:', this.selectedStation, this.selectedStationName);
  }

  initGDFStations() {
    this.dataService.getMesurementGDFStation().then(data => {
      this.stations = data;
      //console.log(this.GDFStationDatas);

      // Initialise `filteredOptions` après avoir chargé les données
      this.filteredOptions = this.myControl.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '')),
      );

      // Définir la valeur initiale de l'input
      const initialOption = this.stations.find(station => station.index === this.sharedService.getSelectedValue());
      //this.selectedWatershed = this.sharedService.getSelectedValue();
      if (initialOption) {
        this.myControl.setValue(initialOption);
      }
    });
  }

  private _filter(value: string): { index: string, station_name: string }[] {
    value = value.toString()
    const filterValue = value.toLowerCase();

    return this.stations
      .filter(station =>
        station.index.toLowerCase().includes(filterValue) ||
        station.station_name.toLowerCase().includes(filterValue)
      )
      .map(station => ({ index: station.index, station_name: station.station_name }));
  }
  
  onStartSimulation() {
    const params = {
      watershed: this.selectedStation,
      slider: this.sliderValue,
      date: this.simulationDate
    };

    this.progressMessages = [];
    this.progressValue = 0;
    this.currentProgressMessage = 'Initialisation de la simulation...';


    this.jsonService.runSimulation(params, this.updateProgress.bind(this)).subscribe(
      (data) => {
        if (data) {
          this.results = data;
          this.taskId = data.task_id;
          this.progressMessages.push('Simulation terminée avec succès.');
          this.showResults = true;
        }
      },
      (error) => {
        this.progressMessages.push('Erreur lors de la simulation.');
        console.error(error);
      }
    );
  }
  
  updateProgress(message: string, progress: number) {
    this.currentProgressMessage = message;
    this.progressValue = progress;
    this.progressMessages.push(message);
  }

  onOptionSelected(event: any) {
    const selectedOption = event.option.value;
    this.sharedService.setSelectedValue(selectedOption.index);
    this.selectedStation = selectedOption.index;
    const select = this.stations.find(station => station.index === selectedOption.index)?.BSS_ID;
    if (select){
      this.selectedStationName = select;
      this.sharedService.setSelectedValueBSS(select);
    }
    console.log('Selected Value:', this.selectedStation, this.selectedStationName);
  }

  isOptionDisabled(option: { index: string, station_name: string }): boolean {
    return this.list_of_disabled_options.includes(option.index);
  }

  displayFn(option: { index: string, station_name: string }): string {
    return option ? `${option.index} - ${option.station_name}` : '';
  }

}
