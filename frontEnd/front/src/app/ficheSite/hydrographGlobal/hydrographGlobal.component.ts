import { Component, Input, SimpleChanges, OnDestroy} from '@angular/core';
import { DataService } from 'src/app/service/data.service';
import { JsonService } from 'src/app/service/json.service';
import * as Plotlydist from 'plotly.js-dist';
import { Layout, AxisType } from 'plotly.js-dist';
import dataDischarge from 'src/app/model/dataDischarge';

/**
 * Définition du composant Angular qui représente un hydrographe global.
 * Le composant affiche des graphiques de débits mesurés.
 */
@Component({
    selector: 'app-hydrographGlobal',
    templateUrl: './hydrographGlobal.component.html',
    styleUrls: ['./hydrographGlobal.component.scss']
})
export class hydrographGlobal implements OnDestroy{

    private resizeListener: () => void;
    // Le paramètre d'entrée qui représente le changement de sélection de la station
    @Input() stationSelectionChange!: string;
    // Variable booléenne pour activer/désactiver des fonctionnalités (ex. échelle logarithmique)
    on: boolean = false;
    // Tableau pour stocker les données de débit hydrologique
    Datadischarge: dataDischarge[] = [];

    /**
     * Constructeur pour injecter les services nécessaires.
     * @param dataService Service pour gérer les données.
     * @param jsonService Service pour obtenir les données en format JSON.
     */
    constructor(private dataService: DataService, private jsonService: JsonService) {
        this.resizeListener = () => {
            const hydrographWidth = 0.72 * window.innerWidth;
            Plotlydist.relayout('hydrograph', { width: hydrographWidth });
        };
    }

    /**
     * Méthode appelée lorsque des changements sont détectés sur les paramètres d'entrée.
     * @param changes Objet contenant les changements des paramètres( dans @Input).
     */
    ngOnChanges(changes: SimpleChanges) {
        // Si la sélection de la station change, initialiser les débits de la station sélectionnée
        if (changes['stationSelectionChange']) {
            this.initStationDischarge(changes['stationSelectionChange'].currentValue);
        }
    }

    ngOnDestroy(){
        window.removeEventListener('resize', this.resizeListener);
    }

    /**
     * Initialise les données de débit pour une station donnée.
     * @param stationID L'ID de la station sélectionnée.
     */
    initStationDischarge(stationID: string) {
        // Récupérer les données de débit de la station via jsonService
        this.jsonService.getDischarge(stationID).then(station => {
            this.Datadischarge = station;
            // Une fois les données récupérées, afficher l'hydrographe
            this.hydrograph();
        });
    }

    /**
     * Méthode appelée lors d'un changement d'état de mat-slide-toggle dans le html.
     * Permet de rafraîchir le graphique.
     */
    onToggleChange() {
        this.hydrograph();
    }

    /**
     * Génère et affiche l'hydrographe en utilisant Plotly.js.
     */
    hydrograph() {
        // Préparer les données pour Plotly
        let df: { x: string; y: string; }[] = [];

        // Transformer les données pour les rendre compatibles avec Plotly
        this.Datadischarge.forEach(station => {
            df.push({ x: station.t, y: station.Q });
        });

        // Label pour l'axe Y
        const yLabel = "Débit (m3/s)";

        // Configuration des données du graphique
        const data: Plotly.Data[] = [{
            x: df.map(entry => entry.x),
            y: df.map(entry => entry.y),
            type: 'scatter',
            mode: 'lines',
            line: { width: 1, color: '#006CD8' },
            name: yLabel
        }];

        // Configuration de la mise en page du graphique
        const layout: Partial<Layout> = {
            title: {
                text: "Débits journaliers mesurés à la station hydrologique",
                x: 0.5,
                font: { family: "Segoe UI Semibold", size: 22, color: 'black' }
            },
            xaxis: { title: "Date" },
            yaxis: { 
                title: yLabel,
                type: this.on ? 'log' as AxisType : undefined 
            },
            font: { size: 14 },
            plot_bgcolor: "rgba(0,0,0,0)",
            paper_bgcolor: "rgba(0,0,0,0)"
        };

        // Afficher le graphique avec Plotly
        Plotlydist.newPlot('hydrograph', data, layout);

        // Ajouter une annotation au graphique
        const name = this.Datadischarge[0];
        const annotation: Partial<Plotly.Annotations> = {
            text: `${name} [${this.stationSelectionChange}]`,
            xref: 'paper', yref: 'paper',
            x: 0.5, y: 1.1,
            showarrow: false,
            font: { family: "Segoe UI Semilight Italic", size: 18, color: "#999" }
        };

        // Appliquer l'annotation au graphique
        Plotlydist.relayout('hydrograph', { annotations: [annotation] });

        // Ajuster la taille du graphique lors du redimensionnement de la fenêtre
        window.addEventListener('resize', this.resizeListener);
    }
}
