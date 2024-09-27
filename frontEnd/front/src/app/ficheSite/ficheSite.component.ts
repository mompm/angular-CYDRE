import { Component, OnInit, SimpleChanges } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
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
 * Composant principal pour la fiche de site
 */
@Component({
    selector: 'app-fiche-site',
    templateUrl: './ficheSite.component.html',
    styleUrls: ['./ficheSite.component.scss']
})

export class FicheSiteComponent {
  currentYear: number = new Date().getFullYear(); // Année actuelle
  years: number[] = Array.from({length: this.currentYear - 1970 + 1}, (_, i) => 1970 + i); // Génère une liste des années depuis 1970
  selectedYears: number[] = [this.currentYear]; // Année sélectionnée initiale (l'année courante)
  DataGDFStation: dataGDFStation[]  =[]; // Liste des données des stations hydologiques
  DataGDFWatershed : dataGDFWatersheds[] = []; // Liste des données des bassins versants
  myControl = new FormControl(); // Contrôle du formulaire pour l'autocomplétion
  filteredOptions!: Observable<{ index: string, station_name: string }[]>; // Options filtrées pour l'autocomplétion
  selectedWatershedID: string  = ''; // ID du bassin versant sélectionné
  selectedStationName: string = ''; // Nom de la station sélectionnée
  selectedWatershedBSS: string  =''; // ID du BSS associé à la station sélectionnée
  previousSelectedStation: { index: string, station_name: string } | null = null;  // Sauvegarde la station précédente

  // Liste des options désactivées
  disabled_station: boolean = true; // boolean si option est desactivé nappe 
  BSS_present: boolean = true; // boolean si BSS liée à la station

  /**
  * Constructeur du composant
  * Injection des services Angular via le constructeur
  * @param cdr Service pour détecter les changements
  * @param dataService Service pour récupérer les données des stations
  * @param jsonService Service pour manipuler les données JSON
  * @param sharedService Service partagé pour gérer les informations communes
  * @param dialog Service de gestion des boîtes de dialogue
  */
  constructor(private cdr: ChangeDetectorRef, private dataService: DataService,private jsonService: JsonService, private sharedService : SharedWatershedService, public dialog : MatDialog) {}
  
  //METHODES CYCLE DE VIE ANGULAR

  /**
  * Méthode appelée lors de l'initialisation du composant
  * Ajoute un écouteur pour les clicks  en dehors du menu deroulant pour gérer la fermeture de listes.
  * récupère les données dans le backend pour la creation de la carte
  */
  ngOnInit() {
    document.addEventListener('click', this.handleClickOutside.bind(this));
    this.initGDFStations();
    this.initGDFWatersheds();
    // Récupération des valeurs de la station selectionnee 
    const ID =  this.sharedService.getSelectedValue();
    const NAME = this.sharedService.getSelectedStationName();
    const BSS = this.sharedService.getSelectedValueBSS();
    // Si des valeurs sont présentes, stocke les valeurs.
    if(ID){
      this.selectedWatershedID =  ID
    }  
    if(NAME){
      this.selectedStationName = NAME;
    }  
    if(BSS){
      this.selectedWatershedBSS = BSS
    }
  }

  //METHODE INITIALISATION DES DONNEES 

  /**
  * récupère les données des gdf des stations
  * contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
  * contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
  * contenus dans geometry: coordinates et type 
  * location du fichier origine :backend/data/stations.csv
  */
  initGDFStations() {
    this.jsonService.getGDFStations().then(data => {
      // Affectation des données des stations hydrologie
      this.DataGDFStation = data;
      // Initialise `filteredOptions` après avoir chargé les données
      this.filteredOptions = this.myControl.valueChanges.pipe(
        startWith(''),// Commence avec une chaîne vide.
        map(value => this._filter(value || '')),// Filtre les résultats en fonction de la saisie utilisateur.
      );
      // Si une station est déjà sélectionnée, elle est définie comme valeur initiale.
      const initialOption = this.DataGDFStation.find(station => station.index === this.sharedService.getSelectedValue());
      // Définit la station initiale dans le contrôle du formulaire.
      if (initialOption) {
        this.myControl.setValue(initialOption);
      }
    });
  }
  
  /**
  * récupère les données des gdf des stations
  * contenus: index(string), name(string), geometry_a(number), hydro_area(number),K1 (any), geometry(any)
  * contenus dans  K1 : si il n'y a pas de donnée K1 =  0 
  * contenus dans geometry: coordinates et type  
  * location du fichier origine :backend/data/stations.csv
  */
  initGDFWatersheds() {
    this.jsonService.getGDFWatersheds().then(data => {
    this.DataGDFWatershed = data;
    });
  }

  // METHODE BOITE DE DIALOGUE

  /**
  * Méthode pour ouvrir une boîte de dialogue avec le composant `PopupDialogFicheSite`
  */
  openDialog() {
    this.dialog.open(PopupDialogFicheSite);
  }

  /**
* Ouvre une boîte de dialogue PopupDialogLoc
* @param event : MouseEvent
*/
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

  openDialogLoc(event: MouseEvent) {

    this.dialog.open(PopupDialogLoc, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false,
      }
    )
    };

  openDialogSuivi(event: MouseEvent) {

    this.dialog.open(PopupDialogSuivi, {
      width: '1000px',
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container',
      hasBackdrop: true,
      backdropClass: 'custom-backdrop',
      autoFocus: false,
      }
    )
  };

  /**
  * Ouvre une boîte de dialogue popupDialogClassif,
  * @param event : MouseEvent
  */ 
  openDialogClassif(event: MouseEvent) {
    const targetElement = event.target as HTMLElement;
    const rect = targetElement.getBoundingClientRect(); // Récupère la position du bouton

    console.log('Position du bouton :', rect);

    this.dialog.open(popupDialogClassif, {
      width: '1000px', // Largeur de la fenêtre
      maxHeight: '80vh', // Limite la hauteur pour éviter le débordement
      panelClass: 'custom-dialog-container', // Classe personnalisée pour ajuster les styles
      hasBackdrop: true,
      backdropClass: 'custom-backdrop', // Ajout de la classe backdrop personnalisée
      autoFocus: false,
      }
    );
  }
    
  //METHODE SELECTION DE LA STATION
  //METHODE FORMULAIRE MENU DEROULANT

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
   * Méthode appelée lorsque l'utilisateur clique dans le champ (click)
   * Vide la sélection actuelle
   */      
  clearSelection() {
    this.previousSelectedStation = this.myControl.value;  // Garde la valeur précédente
    this.myControl.setValue('');  // Vide le champ
  }

  /**
   * Gérer les clics à l'extérieur du champ de saisie
   * @param event - Événement de clic
   */ 
  handleClickOutside(event: MouseEvent) {
    // Vérifie si le clic a eu lieu en dehors du champ de formulaire
    const target = event.target as HTMLElement;
    if (!target.closest('mat-autocomplete') && !target.closest('mat-form-field')) {
      // Restaure la sélection précédente si aucune option n'est sélectionnée
      if (this.myControl.value === '') {
        this.myControl.setValue(this.previousSelectedStation); // Restauration de la sélection précédente
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
    // Obtenir l'option sélectionnée
    const selectedOption = event.option.value; 
    // Sauvegarder l'index de l'option sélectionnée
    this.sharedService.setSelectedValue(selectedOption.index);
    // Assigner l'ID du bassin versant sélectionné
    this.selectedWatershedID = selectedOption.index;
    //obtenir ID BSS et le nom de la station
    const select = this.DataGDFStation.find(station => station.index === selectedOption.index)?.BSS_ID;
    const name = this.DataGDFStation.find(station => station.index === selectedOption.index)?.name;
    // si ID BSS existe stocker dans le component et le service shared
    if (select){
      this.selectedWatershedBSS = select;
      this.sharedService.setSelectedValueBSS(select);
      this.BSS_present= true;
    }else{
      this.BSS_present = false;
    }
    //si nom existe stocker dans le component et le service shared
    if (name){
      this.selectedStationName = name;
      this.sharedService.setSelectedStationName(name);
    }
    // verifier si la station est implementer dans le module
    if (this.sharedService.isWatersheddisabled(selectedOption.index)){
      this.disabled_station = false;
    }else{
      this.disabled_station = true;
    }
  }
  
  /**
  * Vérifie si une option est désactivée
  * @param option - Option à vérifier
  * @returns - True si l'option est désactivée, sinon false
  */
  isOptionDisabled(option: { index: string, station_name: string }): boolean {
    // Vérifie si l'index est dans la liste des désactivés
    return this.sharedService.isWatersheddisabled(option.index);
  }

  /**
  * Affiche le nom de l'option dans le champ de saisie
  * @param option - Option à afficher
  * @returns - Chaîne formatée pour affichage
  */
  displayFn(option: { index: string, station_name: string }): string {
    // Retourne le format souhaité pour l'affichage
    return option ? `${option.index} - ${option.station_name}` : '';
  }

  //METHODE CLICK SUR LA CARTE REGIONAL 
  
  /**
  * Gérer les clics sur les marqueurs de la carte
  * @param id - ID de la station sélectionnée
  */
  handleMarkerClick(id: string): void {
    // Trouver la station par ID
    const selectedOption = this.DataGDFStation.find(station => station.index === id);
    if (selectedOption) {
       // Mettre à jour le formulaire du menu deroulant
      this.myControl.setValue(selectedOption);
      // Assigner l'ID du bassin versant
      this.selectedWatershedID = selectedOption.index;
      // Sauvegarder l'ID sélectionné
      this.sharedService.setSelectedValue(selectedOption.index);
      // verifier si la station est implementer dans le module
      if(this.sharedService.isWatersheddisabled(selectedOption.index)){
        this.disabled_station = false;
      }else{
        this.disabled_station = true;
      }
      // si ID BSS existe stocker dans le component et le service shared
      this.selectedWatershedBSS = selectedOption.BSS_ID;
      if(this.sharedService.getSelectedValueBSS() !=null){
        if(this.sharedService.getSelectedValueBSS() == this.selectedWatershedBSS){
          this.BSS_present= false;
        }else{
          this.sharedService.setSelectedValueBSS(selectedOption.BSS_ID);
          this.BSS_present = true;
        }
      }else{
        this.BSS_present = false;
      }
    }  
  }
}

//COMPONENT BOITE DE DIALOG

/**
* Composant pour la boîte de dialogue de la fiche de site
*/
  @Component({
    selector: 'popupDialogFicheSite',
    templateUrl: './popupDialogFicheSite.html',
  })
  export class PopupDialogFicheSite {}


/**
*
*/
  @Component({
    selector: 'popupDialogSelection',
    templateUrl : './popupDialogSelection.html',
  })
  export class PopupDialogSelection {}

/**
 * Composant pour la boîte de dialogue de localisation
 */
  @Component({
    selector: 'popupDialogLoc',
    templateUrl : './popupDialogLoc.html',
  })
  export class PopupDialogLoc {}

  @Component({
    selector: 'popupDialogSuivi',
    templateUrl : './popupDialogSuivi.html',
  })
  export class PopupDialogSuivi {}

/**
 * Composant pour la boîte de dialogue de classification
 */
@Component({
  selector: 'popupDialogClassif',
  templateUrl : './popupDialogClassif.html',
})
export class popupDialogClassif {}