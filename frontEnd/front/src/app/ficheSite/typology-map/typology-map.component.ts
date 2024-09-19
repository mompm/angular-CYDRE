import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';


@Component({
  selector: 'app-typology-map',
  templateUrl: './typology-map.component.html',
  styleUrls: ['./typology-map.component.scss']
})
export class TypologyMapComponent implements OnInit, OnChanges {

  @Input() selectedWatershedID: string | null = null;
  @Input() DataGDFStation: any[] = [];
  @Input() DataGDFWatershed: any[] = [];

  private map: any;

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedWatershedID'] || changes['DataGDFStation'] || changes['DataGDFWatershed']) {
      this.updateMap();
    }
  }

  initializeMap(): void {
    this.map = L.map('mapy', {
      center: [48.2141667, -2.9424167],
      zoom: 7.5,
      layers: [L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      })]
    });

    L.control.scale({ maxWidth: 100, imperial: false }).addTo(this.map);
    this.map.attributionControl.remove();

    this.updateMap();
  }

  updateMap(): void {
    if (!this.map || !this.DataGDFStation.length || !this.DataGDFWatershed.length) {
      console.log('Map or data not ready');
      return;
    }

    // Nettoyage des anciens polygones
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        this.map.removeLayer(layer);
      }
    });

    // Filtrage des stations
    const gdf_stations_filter = this.DataGDFStation.filter(station => station.typology != 99);
    
    // Création des polygones filtrés
    const gdf_watersheds_filter = this.DataGDFWatershed
      .filter(watershed => gdf_stations_filter.some(station => station.index === watershed.index))
      .map(watershed => {
        const matchingStation = gdf_stations_filter.find(station => station.index === watershed.index);
        return {
          ...watershed,
          typology: matchingStation ? matchingStation.typology : null
        };
      });

    // Définir les couleurs pour les typologies
    const colors: { [key: number]: string } = {
      0: '#0000FF',
      1: '#FF0000',
      2: '#FFFF66',
      3: '#3399FF',
      4: '#66FF99',
      5: '#FFCC66',
      6: '#99FF66'
    };

    // Récupère la typologie de la station sélectionnée
    const selectedTypology = this.DataGDFStation.find(station => station.index === this.selectedWatershedID)?.typology;
    console.log('Selected Typology:', selectedTypology);

    // Trouver les stations du même groupe que la sélection
    const selectedStations = gdf_stations_filter.filter(station => station.typology === selectedTypology);
    console.log('quelles stations?', selectedStations)

    const stationsList = document.getElementById('stations-list');
    if (stationsList) {
      stationsList.innerHTML = ''; // Réinitialiser la liste

      selectedStations.forEach(station => {
        const listItem = document.createElement('li');
        listItem.textContent = station.station_name; // Nom de la station

        // Ajouter la classe selected-station si c'est la station sélectionnée
        if (station.index === this.selectedWatershedID) {
          listItem.classList.add('selected-station');
        }

        stationsList.appendChild(listItem);
      });
    }
    console.log('Liste des stations:', stationsList)
    
    // Création des polygones pour les bassins versants
    gdf_watersheds_filter.forEach(data => {
      const typology = Number(data.typology) as keyof typeof colors;
      const fillColor = colors[typology] || '#CCCCCC'; // Couleur par défaut si typology non définie
      const opacity = selectedTypology !== null && selectedTypology !== typology ? 0.2 : 0.9;
      const Color = selectedTypology !== null && selectedTypology !== typology ? 'gray' : 'black';
      const Weight = selectedTypology !== null && selectedTypology !== typology ? 0.25 : 1;
      const isSelected = selectedTypology !== null && selectedTypology === typology;

      console.log('Adding polygon with fillColor:', fillColor, 'and opacity:', opacity);

      // Récupère les coordonnées du polygone
      const polygonCoords = data.geometry.coordinates[0].map((coord: any[]) => [coord[1], coord[0]]);
      

      // Ajoute le polygone à la carte avec la couleur appropriée
      const polygon = L.polygon(polygonCoords, {
        color: Color, //'white',
        weight: Weight,
        fillColor: fillColor,
        fillOpacity: opacity,
      })
      // .bindTooltip(data.name, {
      //   permanent: false,
      //   direction: 'top',
      //   opacity: 1
      // })
      .addTo(this.map);

       // Mettre le polygone sélectionné au premier plan
      if (isSelected) {
        polygon.bringToFront();
      }
    });


  // Création des exutoires
  gdf_stations_filter.forEach(outlet => {
    
    const fillColor = '#000000';

    // Création d'un marqueur circulaire pour chaque exutoire
    const marker = L.circleMarker([outlet.y_outlet, outlet.x_outlet], {
      radius: 3,           // Taille du cercle
      fillColor: fillColor, // Couleur de remplissage (noir)
      color: fillColor,     // Couleur de bordure (noir)
      weight: 0,            // Épaisseur de la bordure
      opacity: 0,           // Opacité de la bordure
      fillOpacity: 0.8      // Opacité du remplissage
    })
    .bindTooltip(outlet.station_name, {
      permanent: false,
      direction: 'top',
      opacity: 1
    })
    .addTo(this.map);      // Ajouter le marqueur à la carte
  });

  }
}
