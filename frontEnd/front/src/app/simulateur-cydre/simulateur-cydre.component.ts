import { Component, OnInit, OnDestroy , ViewChild, ElementRef} from '@angular/core';
import { Options } from '@angular-slider/ngx-slider';
import { JsonService } from '../service/json.service';
import { HttpClient } from '@angular/common/http';
import { SharedWatershedService } from '../service/shared-watershed.service';
import { FormControl } from '@angular/forms';
import { Observable, generate, map, startWith } from 'rxjs';
import { DataService } from '../service/data.service';
import {MatDialog} from '@angular/material/dialog';
import { AuthService } from '../service/auth.service';
import { ParametersPanelComponent } from '../parameters-panel/parameters-panel.component';



@Component({
  selector: 'app-simulateur-cydre',
  templateUrl: './simulateur-cydre.component.html',
  styleUrls: ['./simulateur-cydre.component.scss']
})
export class SimulateurCydreComponent implements OnInit, OnDestroy {
  @ViewChild(ParametersPanelComponent) parametersPanel!: ParametersPanelComponent;

togglePanel() {
  this.showParametersPanel = !this.showParametersPanel;
}

  constructor(private jsonService: JsonService, private http: HttpClient, private sharedService : SharedWatershedService, private dataService: DataService, private authService : AuthService, public dialog : MatDialog) { }
  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;
  selectedFile: File | null = null;
  showParametersPanel :boolean = false;
  myControl = new FormControl();
  filteredOptions!: Observable<{ index: string, station_name: string }[]>;
  progressMessages: string[] = [];
  progressValue = 0;
  currentProgressMessage = '';
  stations: any[] = [];
  selectedStation: string | null | undefined;
  selectedStationName: string | null | undefined;
  selectedStationBSS: string | null | undefined;
  selectedStationDisabled: boolean | undefined;
  sliderValue: number = 60;
  simulationDate: string = new Date().toISOString().split('T')[0];
  isModalOpen: boolean = false;
  simulation_id = ""
  parameters = {}
  
  list_of_disabled_options: string[] = [
    'J0121510', 'J0621610', 'J2233010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
    'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210','J7373110', 'J8433010', 'J8502310', 
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
    ticksArray: [0, 20, 40, 60, 80, 100, 120], // Spécifie les emplacements des gros points
    translate: (value: number): string => {
      return value.toString();
    }
};

  async ngOnInit() {
    
    this.initGDFStations();
    this.selectedStation = this.sharedService.getSelectedValue();
    this.selectedStationName =this.sharedService.getSelectedStationName();
    this.selectedStationBSS = this.sharedService.getSelectedValueBSS();

    //récupérer les données de la simulation choisie si on vient de l'historique
    if(localStorage.getItem('showLastSimul')=="true"){
      if(localStorage.getItem('lastSimulationId')){
        let data = await this.jsonService.getResults(localStorage.getItem('lastSimulationId')!);
            if (data) {
              this.simulation_id = data.simulation_id;
              this.results = this.deepParseJson(data);
              this.progressMessages.push('Simulation chargée avec succès.');
              this.showResults = true;
            }
          }else{
            this.progressMessages.push('Erreur lors du chargement la simulation.');
                    }
      }
      localStorage.removeItem("showLastSimul");
    }

  ngOnDestroy() {
    this.authService.isLoggedIn.subscribe(isLoggedIn => {
        if (!isLoggedIn) {
            this.deleteSimulation(this.simulation_id);
            this.results = {}
        }
    }).unsubscribe();  // Important de désabonner pour éviter les fuites de mémoire
}

  private deleteSimulation(simulation_id:string) {
    this.http.post(`http://localhost:5000/api/delete_simulation/${simulation_id}`, {}).subscribe({
      next: (response) => console.log('Simulation deleted successfully'),
      error: (error) => console.error('Failed to delete simulation', error)
    });
  }

  initGDFStations() {
    this.jsonService.getGDFStations().then(data => {
      this.stations = data;


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


  deepParseJson(obj: any): any {
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            obj[key] = this.deepParseJson(obj[key]);  // Appel récursif pour chaque propriété
        }
    } else if (typeof obj === 'string') {
        try {
            return JSON.parse(obj);  // Tente de parser la chaîne en JSON
        } catch (e) {
            // Si ce n'est pas du JSON, retourne simplement la chaîne
        }
    }
    return obj;
}

handleParametersChanged(parameters: any) {
  this.parameters = parameters;
  console.log('Parameters received in parent:', this.parameters);
  // Add your logic to handle the parameters and start the simulation
}
  async onStartSimulation() {
    //affiche le poppup error si la station selection est dans list_of_disabled_options
    if (this.sharedService.isWatersheddisabled(this.selectedStation)){
      this.dialog.open(ErrorDialog);
    }
    //sinon start simulation 
    else{
      this.parametersPanel.getFormValues();
    const params = {
      Parameters :{
        user_watershed_id: this.selectedStation,
        user_horizon: this.sliderValue,
        date: this.simulationDate,
        ...this.parameters,
      },
      UserID : localStorage.getItem("UserID")
    };
    console.log("localStorage UserID" , localStorage.getItem("UserID"))

    this.progressMessages = [];
    this.progressValue = 0;
    this.currentProgressMessage = 'Initialisation de la simulation...';

try{
    let data = await this.jsonService.runSimulation(params, this.updateProgress.bind(this))

        if (data) {
          this.simulation_id = data.simulation_id;
          this.results = this.deepParseJson(data.results);
          this.progressMessages.push('Simulation terminée avec succès.');
          this.saveSimulationId(this.simulation_id);
          this.showResults = true;
          console.log(this.results)
        }
      }catch(error){
        this.progressMessages.push('Erreur lors de la simulation.');
        console.error(error);
      }
    }
  }



  saveSimulationId(simulationId: string) {
    localStorage.setItem('lastSimulationId', simulationId);
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
    const test = this.stations.find(station => station.index === selectedOption.index)?.name;
    const select = this.stations.find(station => station.index === selectedOption.index)?.BSS_ID;
    if (select){
      this.selectedStationBSS = select;
      this.sharedService.setSelectedValueBSS(select);
    }
    if (test){
      this.selectedStationName = test;
      this.sharedService.setSelectedStationName(test);
    }
    console.log('Selected Value:', this.selectedStation, this.selectedStationBSS, test);
  }

  isOptionDisabled(option: { index: string, station_name: string }): boolean {
    return this.list_of_disabled_options.includes(option.index);
  }

  displayFn(option: { index: string, station_name: string }): string {
    return option ? `${option.index} - ${option.station_name}` : '';
  }

  openDialog() {
    this.dialog.open(PopupDialogSimulateur);
  }


}
  /**
   * 
   */
  @Component({
    selector: 'popupDialogSimulateur',
    templateUrl: './popupDialogSimulateur.html',
  })
  export class PopupDialogSimulateur {}


    /**
   * 
   */
    @Component({
      selector: 'errorDialog',
      templateUrl: './errorDialog.html',
    })
    export class ErrorDialog {}
  