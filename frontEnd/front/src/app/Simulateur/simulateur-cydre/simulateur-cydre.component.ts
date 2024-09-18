//librairies pour la gestion des composants, de la vue, et des modules matériels
import { Component, OnInit, OnDestroy , ViewChild, ElementRef, ChangeDetectorRef} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDialog} from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
//permet de gérer le slider
import { Options } from '@angular-slider/ngx-slider';
//Permet de gérer les requêtes HTTP
import { HttpClient } from '@angular/common/http';
//observables
import { Observable, generate, map, startWith } from 'rxjs';
//services gestion donnée et authentification
import { SharedWatershedService } from 'src/app/service/shared-watershed.service';
import { JsonService } from 'src/app/service/json.service';
import { DataService } from 'src/app/service/data.service';
import { AuthService } from 'src/app/service/auth.service';
import { ParametersPanelComponent } from 'src/app/parameters-panel/parameters-panel.component';




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

  constructor(private cdr: ChangeDetectorRef, private jsonService: JsonService, private http: HttpClient, private sharedService : SharedWatershedService, private dataService: DataService, private authService : AuthService, public dialog : MatDialog,
    private router : Router
  ) {}

  //Variables generale
  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;
  selectedFile: File | null = null;
  isModalOpen: boolean = false;

  //Variable selection de la station
  myControl = new FormControl();
  filteredOptions!: Observable<{ index: string, station_name: string }[]>;
  stations: any[] = [];
  selectedStation: string | null | undefined;
  selectedStationName: string | null | undefined;
  selectedStationBSS: string | null | undefined;
  selectedStationDisabled: boolean | undefined;
  previousSelectedStation: { index: string, station_name: string } | null = null;  
  list_of_disabled_options: string[] = [
    'J0121510', 'J0621610', 'J2233010', 'J3403010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
    'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210','J7373110', 'J8433010', 'J8502310', 
  ];

  //Variables paramètres simulation
  showParametersPanel :boolean = false;
  parameters = {}
  sliderValue: number = 60;
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
  simulationDate: string = new Date().toISOString().split('T')[0];
  
  
  //Variables barre de chargement
  progressMessages: string[] = [];
  progressValue = 0;
  currentProgressMessage = '';
  
  //Variables simulations et resultat
  simulation_id = ""
  taskId: string | undefined;
  fetchingResults  : boolean =false;
  simulationResults: any = null;
  results: any = {}; 
  showResults :boolean = false;


  //METHODE CYCLE ET GENERAL DU COMPOSANT 

  /**
  * méthode cycle initialisation du composant chargement des données de la station, vérification de l'authentification de l'utilisateur 
  * et récupération des résultats de simulations précédentes
  */
  async ngOnInit() {
    //active l'observation si l'utilisateur click à l'exterieur du formulaire de selection des stations
    document.addEventListener('click', this.handleClickOutside.bind(this));
    //gere si l'utilisateur est connecter
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
    }
    //chargement des données de la station
    this.initGDFStations();
    this.selectedStation = this.sharedService.getSelectedValue();
    this.selectedStationName =this.sharedService.getSelectedStationName();
    this.selectedStationBSS = this.sharedService.getSelectedValueBSS();
    //récupérer les données de la simulation choisie si on vient de l'historique
    if(sessionStorage.getItem('showLastSimul')=="true"){
      if(sessionStorage.getItem('lastSimulationId')){
        let data = await this.jsonService.getResults(sessionStorage.getItem('lastSimulationId')!);
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
      sessionStorage.removeItem("showLastSimul");
  }

  /**
  * Méthode cycle pour gérer la mémoire si on quitte le composant ( supression de la simulation active)
  */  
  ngOnDestroy() {
    this.authService.isLoggedIn.subscribe(isLoggedIn => {
        if (!isLoggedIn) {
            this.deleteSimulation(this.simulation_id);
            this.results = {}
        }
    }).unsubscribe();  // Important de désabonner pour éviter les fuites de mémoire
  }

  /**
  * méthode permettant ce récuperer les données des stations dans le backend
  */
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

  //METHODES POUR LA SELECTION DE LA STATION

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
    return this.stations
      .filter(station =>
        station.index.toLowerCase().includes(filterValue) ||
        station.station_name.toLowerCase().includes(filterValue)
      )
       // Retourne un tableau d'objets avec l'index et le nom de la station correspondante
      .map(station => ({ index: station.index, station_name: station.station_name }));
  }

  /**
  * Méthode appelée lorsque l'utilisateur clique dans le champ (click)
  */
  clearSelection() {
    this.previousSelectedStation = this.myControl.value;  // Garde la valeur précédente
    this.myControl.setValue('');  // Vide le champ
  }

  /**
  * Méthode pour gérer si l'utiilsateur clic hors de du formulaire de sélection 
  * @param event evenement avec la souris
  */ 
  handleClickOutside(event: MouseEvent) {
    // Vérifie si le clic a eu lieu en dehors du champ de formulaire
    const target = event.target as HTMLElement;
    if (!target.closest('mat-autocomplete') && !target.closest('mat-form-field')) {
      // Restaure la sélection précédente si aucune option n'est sélectionnée
      if (this.myControl.value === '') {
        this.myControl.setValue(this.previousSelectedStation);
        this.cdr.detectChanges(); // Forcer la détection des changements
      }
    }
  }

  /**
  * Gère la sélection d'une option dans le dropdown.
  * Met à jour les valeurs sélectionnées et les enregistre dans le service partagé.
  *
  * @param event - L'événement de sélection déclenché par l'utilisateur lors du choix d'une option dans le dropdown.
  */
  onOptionSelected(event: any) {
    if (event.option.value) {
      const selectedOption = event.option.value;
      this.previousSelectedStation = selectedOption;  // Met à jour la sélection précédente
      this.jsonService.getBetaSimulation(selectedOption.index).subscribe((response) => {
        this.results = this.deepParseJson(response);
        this.showResults = true;
        
      });
      this.sharedService.setSelectedValue(selectedOption.index);
      this.selectedStation = selectedOption.index;
      const name = this.stations.find(station => station.index === selectedOption.index)?.name;
      const select = this.stations.find(station => station.index === selectedOption.index)?.BSS_ID;
      if (select) {
        this.selectedStationBSS = select;
        this.sharedService.setSelectedValueBSS(select);
      }
      if (name) {
        this.selectedStationName = name;
        this.sharedService.setSelectedStationName(name);
      }
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
    //Retourne true si l'index de l'option figure dans la liste des options désactivées
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

  //METHODE SIMULATION

  /**
   * Methode pour gérer les chamgements dans la zone des paramètres
   * @param parameters valeurs modifiées
   */
  handleParametersChanged(parameters: any) {
    this.parameters = parameters;
    console.log('Parameters received in parent:', this.parameters);
  }

  /**
   * Methode pour mettre à jour les valeurs de la barre de chargement 
   * @param message message recus
   * @param progress valeur recus
   */
  updateProgress(message: string, progress: number) {
      this.currentProgressMessage = message;
      this.progressValue = progress;
      this.progressMessages.push(message);
  }

  /**
  * Methode pour gere la simulation lors du clic sur le bouton 'lancer simulation'
  */
  async onStartSimulation() {
    //permet de masquer l'ancien résulat si une simulation est déjà affiché
    if(this.showResults){
      this.results = false
    }
    let params = {}
    let UserID = 0
    //affiche le poppup error si la station selection est dans list_of_disabled_options
    if (this.sharedService.isWatersheddisabled(this.selectedStation)){
      this.dialog.open(ErrorDialog);
    }
    //sinon start simulation 
    else{
      this.fetchingResults = true;
      if(this.authService.isLoggedIn){
        UserID = Number(sessionStorage.getItem("UserID"))
      }

    if(this.showParametersPanel){
      this.parametersPanel.getFormValues();
      params = {
        Parameters :{
          ...this.parameters,
        },
        UserID : UserID

      }
    }else{
        params = {
          Parameters :{
            user_watershed_id: this.selectedStation,
            user_horizon: this.sliderValue,
            date: this.simulationDate,
          },
          UserID:UserID
      }

    }
    console.log("sessionStorage UserID" , sessionStorage.getItem("UserID"))

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
      this.fetchingResults = false;

    }
  }

  /**
  * Methode pour sauvegarder la simulation dans l'historique
  * @param simulationId id de la simulation présente
  */
  saveSimulationId(simulationId: string) {
    sessionStorage.setItem('lastSimulationId', simulationId);
  }

  /**
  * Methode pour update la simulation dans l'historique
  */
  async updateSimulationsBeta() {
    this.filteredOptions.subscribe(async (stationsArray) => {
      for (const station of stationsArray) {
        console.log("Updating station : " + station.index);
        try {
          await this.jsonService.updateSimualtionsBetaDatabase(station.index);
        } catch (error) {
          console.error(`Failed to update station ${station.index}`, error);
        }
      }
    });
  }

  /**
  * Methode pour supprimer la simulation dans l'historique
  * @param simulation_id id de la simulation présente
  */
  private deleteSimulation(simulation_id:string) {
    this.http.post(`http://localhost:5000/api/delete_default_simulation`, {}).subscribe({
        next: (response) => console.log('Simulation deleted successfully'),
        error: (error) => console.error('Failed to delete simulation', error)
      });
  }

  //METHODE BOITE DE DIALOGUE    
    
  openDialog() {
    this.dialog.open(PopupDialogSimulateur);
  }

  openDialogConditions(event: MouseEvent) {
    const targetElement = event.target as HTMLElement;
    const rect = targetElement.getBoundingClientRect(); // Récupère la position du bouton

    this.dialog.open(PopupDialogConditions, {
      width: '500px',   // Largeur de la fenêtre
      maxHeight: '80vh', // Limite la hauteur pour éviter qu'elle déborde
      panelClass: 'custom-dialog-container', // Classe personnalisée pour ajuster les styles
      hasBackdrop: true,
      backdropClass: 'custom-backdrop', // Ajout de la classe backdrop personnalisée
      autoFocus: false,
      position: {
        top: `${rect.bottom - 200}px`, // 10px en dessous du bouton
        left: `${rect.right + 20}px`,   // 5px à droite du bouton
        right: 'auto',                 // Laisser l'alignement horizontal au contenu
        bottom: 'auto'  
      }
    });
  }

  openDialogSelection(event: MouseEvent) {
    this.dialog.open(PopupDialogSelection, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false,
      }
    )
    }

  //METHODES POUR SIMPLIFIER LE CODE//   
  userIsScientificOrDev(){
    return this.authService.isScientificOrDev
  }
  userIsDev(){
    return this.authService.isDev
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

}
  
  @Component({
    selector: 'popupDialogSimulateur',
    templateUrl: './popupDialogSimulateur.html',
  })
  export class PopupDialogSimulateur {}

  @Component({
    selector: 'popupDialogSelection',
    templateUrl: './popupDialogSelection.html',
  })
  export class PopupDialogSelection {}

  @Component({
    selector: 'popupDialogConditions',
    templateUrl: './popupDialogConditions.html',
  })
  export class PopupDialogConditions {}

  @Component({
    selector: 'errorDialog',
    templateUrl: './errorDialog.html',
  })
  export class ErrorDialog {}
  