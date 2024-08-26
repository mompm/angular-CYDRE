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

    /**
     * fonction qui vérifie si les données des stations sont récupérées alors on affiche la carte de typologie 
     * bloque par le boolean mapInit pour éviter une boucle infinie
     */
    ngDoCheck() { 
      if(this.DataGDFStation.length > 0 && this.DataGDFWatershed.length >0 && this.mapInit){
        //this.MapTypologiePlotly()
        this.MapTypologieLeaflet();
        this.mapInit = false;
      }
    }
    

    MapTypologiePlotly(){
      let gdf_stations_filter : any[] = [];
      const gdf_watersheds_filter : any[]= [];
      
      for(let key in this.DataGDFStation){
        if(this.DataGDFStation[key].typology != 99){
          gdf_stations_filter.push(this.DataGDFStation[key]);
        }
      }
      console.log(gdf_stations_filter);
     //gdf_stations_filter = this.DataGDFStation;
      for (let key in this.DataGDFWatershed){
        for(let keystation in gdf_stations_filter){
          if(this.DataGDFWatershed[key].index == gdf_stations_filter[keystation].index){
            let watershedCopy = {
              ...this.DataGDFWatershed[key],
              typology: gdf_stations_filter[keystation].typology
          };
          // Ajout de l'objet modifié à gdf_watersheds_filter
          gdf_watersheds_filter.push(watershedCopy);
          }
        }
      }
      const colors: { [key: number]: string } = {
        0: '#1f77b4',   // Bleu
        1: '#ff7f0e',   // Orange
        2: '#2ca02c',   // Vert
        3: '#d62728',   // Rouge
        4: '#9467bd',   // Violet
        5: '#8c564b',   // Marron
        6: '#e377c2',   // Rose
      };

      const typologyNames: { [key: number]: string } = {
        0: '0',
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
    };
        const x: any[] = [];
        const y: any[] = [];
        const colorsfill: any[] = [];
        const hovertexts: string[] = [];
        for (let i = 0; i < gdf_stations_filter.length; i++) {
          x.push(Number(gdf_stations_filter[i].x_outlet)); 
          y.push(Number(gdf_stations_filter[i].y_outlet));
          let typology = Number(gdf_stations_filter[i].typology);
          let fill = colors[typology];  // Récupère la couleur selon la typologie
          colorsfill.push(fill);
          let hovertext = `
            <b>Identifiant:</b> ${gdf_stations_filter[i].index}<br>
            <b>Nom de la station hydrologique:</b> ${gdf_stations_filter[i].station_name}<br>
            <b>Groupe:</b> ${gdf_stations_filter[i].typology}`;
        hovertexts.push(hovertext);
        }

        
        const figData: any[] = [];
        Object.keys(colors).forEach((key) => {
          figData.push({
              type: 'scattermapbox',
              lon: [0,0,0,0,0,0,0,0,0,0,0],  
              lat: [0,0,0,0,0,0,0,0,0,0,0],
              mode: 'markers',
              marker: {
                  color: colors[Number(key)],
                  size: 10,
              },
              showlegend: true,
              name: typologyNames[key as any],  // Utilisez le nom de la typologie pour la légende
          });
      });
        const figLayout = {
            mapbox: {
                style: 'carto-positron',
                center: { lat: 48.2141667, lon: -2.9424167 },
                zoom: 7,
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 0, r: 0, t: 0, b: 0 },
            showlegend: true,
            legend: {
              title: {
                  text: 'Légende des Typologies',
                  font: {
                      size: 12,
                      color: '#000'  // Couleur du texte du titre
                  }
              },
            }
            
        };
      const watershedPolygons = this.DataGDFWatershed.map((data, index) => {
          const polygonCoords = data.geometry.coordinates[0];
          return {
              type: 'scattermapbox',
              lon: polygonCoords.map((coord: number[]) => coord[0]),
              lat: polygonCoords.map((coord: number[]) => coord[1]),
              mode: 'lines',
              line: { width: 0.8, color: '#3E88A6' },
              fill: 'toself',
              fillcolor: 'transparent',
              hoverinfo: 'none',
              name: `Watershed Boundaries ${index + 1}`,
              showlegend: false,
          };
      });
      figData.push(...watershedPolygons);

        figData.push({
          type: 'scattermapbox',
          lon: x,
          lat: y,
          mode: 'markers',
          marker: {
              color: colorsfill,
              opacity: 0.8,  // Ajustez l'opacité au besoin
              size: 10,      // Ajustez la taille des marqueurs au besoin
          },
          hoverinfo: 'text',
          hovertext: hovertexts,
          name: '',
          showlegend: false,
      });
        Plotly.newPlot('mappy', figData, figLayout);
    }



    MapTypologieLeaflet() {
      let gdf_stations_filter : any[] = [];
      const gdf_watersheds_filter : any[]= [];
      
      for(let key in this.DataGDFStation){
        if(this.DataGDFStation[key].typology != 99){
          gdf_stations_filter.push(this.DataGDFStation[key]);
        }
      }

      for (let key in this.DataGDFWatershed){
        for(let keystation in gdf_stations_filter){
          if(this.DataGDFWatershed[key].index == gdf_stations_filter[keystation].index){
            let watershedCopy = {
              ...this.DataGDFWatershed[key],
              typology: gdf_stations_filter[keystation].typology
          };
          // Ajout de l'objet modifié à gdf_watersheds_filter
          gdf_watersheds_filter.push(watershedCopy);
          }
        }
      }

      const WatLayers = {
        "ligthMap" : L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }),
      };
      if (this.mapy) {
        this.mapy.remove();
      }
      this.mapy = L.map('mapy', {
        center: [48.2141667, -2.9424167],
        zoomControl: true,
        zoom: 7.5,
      layers: [WatLayers['ligthMap']]
    });

    L.control.scale({ maxWidth: 100, imperial: false }).addTo(this.mapy);
    this.mapy.attributionControl.remove();

    //création des polygones de toutes les stations
      //boucle pour parcourir toutes les stations
      gdf_watersheds_filter.forEach((data, index) => {
        //récupère les coordonées du polygones
        const polygonCoords= data.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
        //ajout du polygone
        L.polyline(polygonCoords, {
          color: '#3E88A6',
          weight: 0.8,
          fill : false,
          opacity: 1
        }).addTo(this.mapy);
      });

      const colors: { [key: number]: string } = {
        0: '#1f77b4',   // Bleu
        1: '#ff7f0e',   // Orange
        2: '#2ca02c',   // Vert
        3: '#d62728',   // Rouge
        4: '#9467bd',   // Violet
        5: '#8c564b',   // Marron
        6: '#e377c2',   // Rose
      };

      const typologyNames: { [key: number]: string } = {
        0: '0',
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
      };

      gdf_stations_filter.forEach(station => {
        let typology = Number(station.typology) as keyof typeof colors;
        let fillColor = colors[typology];
        let marker = L.circleMarker([station.y_outlet, station.x_outlet], {
          radius: 5,
          fillColor: fillColor,
          color: fillColor,
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(this.mapy);

        marker.bindTooltip(`
          <b>ID:</b> ${station.index}<br>
          <b>Nom:</b> ${station.station_name}<br>
          <b>Groupe:</b> ${station.typology}
        `, {
          direction: 'top',
          permanent: false,
          sticky: true
        });
    
        // marker.bindPopup(`
        //   <b>ID:</b> ${station.index}<br>
        //   <b>Nom:</b> ${station.station_name}<br>
        //   <b>Groupe:</b> ${station.typology}
        // `);
      });

 // Ajout de la légende dans la div HTML
 const legendItemsContainer = document.getElementById('legend-items');
 if (legendItemsContainer) {
   const grades = Object.keys(colors) as unknown as (keyof typeof colors)[];
   console.log(grades);
   grades.forEach(grade => {
     const legendItem = document.createElement('div');
     legendItem.className = 'legend-item';
     legendItem.innerHTML = `
        <div style ="display: flex; align-items: center;">
       <div style="width: 10px; height: 10px; background-color:${colors[grade]}; border-radius: 50%; margin-right: 10px"></div>
       <div>${typologyNames[grade]}</div>
       </div>
     `;
     legendItemsContainer.appendChild(legendItem);
   });
 }
}

    /**
     * fonction ouverture des popups de la Fiche de site
     */
    openDialog() {
      this.dialog.open(PopupDialogFicheSite);
    }

    openDialogLoc() {
      this.dialog.open(PopupDialogLoc);
    }
  }
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