import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, catchError, concatMap, finalize, forkJoin, from, lastValueFrom, map, of, switchMap, takeWhile, tap, timer, toArray } from 'rxjs';
import dataGDFWatersheds from '../model/dataGDFWatersheds';
import dataGDFPiezometry from '../model/dataGDFPiezometry';
import dataDischarge from '../model/dataDischarge';
import dataGDFStation from '../model/dataGDFStation';
import dataTemperature from '../model/dataTemperature';
import dataDepth from '../model/dataDepth';
import dataPrecipitation from '../model/dataPrecipitation';
import { forEach } from 'mathjs';



@Injectable({
  providedIn: 'root'
})
export class JsonService {

	private baseUrl = ''; // URL de base pour les requêtes API.
  
	constructor(private http: HttpClient) {} // Constructeur qui initialise HttpClient.
  
	/**
	 * Méthode pour mettre à jour la base de données des simulations beta pour une station donnée.
	 * @param station - Le nom de la station à mettre à jour.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	async updateSimualtionsBetaDatabase(station: string): Promise<any> {
	  return lastValueFrom(this.http.post("api/updateSimulationsBeta", { station: station })); // Envoi d'une requête POST pour mettre à jour la base de données.
	}
  
	/**
	 * Méthode pour récupérer les bassins versants GDF.
	 * @returns Une promesse contenant un tableau de bassins versants.
	 */
	getGDFWatersheds(): Promise<Array<dataGDFWatersheds>> {
	  return lastValueFrom(this.http.get<Array<dataGDFWatersheds>>("osur/GetGDFWatersheds")); // Envoi d'une requête GET pour récupérer les bassins versants.
	}
  
	/**
	 * Méthode pour récupérer les stations GDF.
	 * @returns Une promesse contenant un tableau de stations.
	 */
	getGDFStations(): Promise<Array<dataGDFStation>> {
	  return lastValueFrom(this.http.get<Array<dataGDFStation>>("osur/GetGDFStations")); // Envoi d'une requête GET pour récupérer les stations.
	}
  
	/**
	 * Méthode pour récupérer les données de piézométrie GDF.
	 * @returns Une promesse contenant un tableau de données de piézométrie.
	 */
	getGDFPiezometry(): Promise<Array<dataGDFPiezometry>> {
	  return lastValueFrom(this.http.get<Array<dataGDFPiezometry>>("/osur/getGDFPiezometry")); // Envoi d'une requête GET pour récupérer les données de piézométrie.
	}
  
	/**
	 * Méthode pour récupérer les données de débit pour une station donnée.
	 * @param id - L'identifiant de la station.
	 * @returns Une promesse contenant un tableau de données de débit.
	 */
	getDischarge(id: string): Promise<Array<dataDischarge>> {
	  const url = `/osur/stationDischarge/${id}`; // Construction de l'URL avec l'identifiant de la station.
	  return lastValueFrom(this.http.get<Array<dataDischarge>>(url)); // Envoi d'une requête GET pour récupérer les données de débit.
	}
  
	/**
	 * Méthode pour récupérer les données de température pour une station donnée.
	 * @param id - L'identifiant de la station.
	 * @returns Une promesse contenant un tableau de données de température.
	 */
	getTemperature(id: string): Promise<Array<dataTemperature>> {
	  const url = `/osur/stationTemperature/${id}`; // Construction de l'URL avec l'identifiant de la station.
	  return lastValueFrom(this.http.get<Array<dataTemperature>>(url)); // Envoi d'une requête GET pour récupérer les données de température.
	}
  
	/**
	 * Méthode pour récupérer les données de profondeur d'eau pour une station donnée.
	 * @param id - L'identifiant de la station.
	 * @returns Une promesse contenant un tableau de données de profondeur.
	 */
	getDepth(id: string): Promise<Array<dataDepth>> {
	  const url = `/osur/stationWaterTableDepth/${id}`; // Construction de l'URL avec l'identifiant de la station.
	  return lastValueFrom(this.http.get<Array<dataDepth>>(url)); // Envoi d'une requête GET pour récupérer les données de profondeur d'eau.
	}
  
	/**
	 * Méthode pour récupérer les données de précipitation pour une station donnée.
	 * @param id - L'identifiant de la station.
	 * @returns Une promesse contenant un tableau de données de précipitation.
	 */
	getPrecipitation(id: string): Promise<Array<dataPrecipitation>> {
	  const url = `/osur/stationPrecipitation/${id}`; // Construction de l'URL avec l'identifiant de la station.
	  return lastValueFrom(this.http.get<Array<dataPrecipitation>>(url)); // Envoi d'une requête GET pour récupérer les données de précipitation.
	}
  
	/**
	 * Méthode pour exécuter une simulation en suivant plusieurs étapes, en rapportant les progrès à travers un callback.
	 * @param params - Les paramètres nécessaires pour la simulation.
	 * @param progressCallback - Callback pour mettre à jour la progression de la simulation.
	 * @returns Une promesse contenant les résultats de la simulation.
	 */
	async runSimulation(params: any, progressCallback: (message: string, progress: number) => void): Promise<any> {
	  let simulation_id: string; // Variable pour stocker l'identifiant de la simulation.
	  try {
		progressCallback('Préparation de la simulation...', 0); // Indiquer le début de la simulation.
  
		const CreateSimulationResponse = await this.CreateSimulation(params); // Créer la simulation.
		simulation_id = CreateSimulationResponse.SimulationID; // Récupérer l'ID de la simulation.
		progressCallback('Récupération des conditions de la prévision', 10); // Indiquer la progression.
		console.log('Simulation ID:', simulation_id); // Afficher l'ID de la simulation dans la console.
  
		await this.runSpatialSimilarity(simulation_id); // Exécuter la similarité spatiale.
		progressCallback('Typologie de bassins versants : OK', 20); // Indiquer la progression.
		console.log('Similarités spatiales exécutées');
  
		await this.runTimeseriesSimilarity(simulation_id); // Exécuter la similarité temporelle.
		progressCallback('Identification des années similaires : OK', 50); // Indiquer la progression.
		console.log('Similarités temporelles exécutées');
  
		await this.runScenarios(simulation_id); // Exécuter les scénarios.
		progressCallback('Sélection des événements similaires : OK', 60); // Indiquer la progression.
		console.log('Scenarios exécutés');
  
		await this.getForecastResults(simulation_id); // Récupérer les résultats de prévision.
		progressCallback('Préparation des résultats', 75); // Indiquer la progression.
		console.log('Graphe généré');
  
		const results = await this.getResults(simulation_id); // Récupérer les résultats finaux.
		progressCallback('Fin de la prévision !', 100); // Indiquer la fin de la simulation.
		console.log('Résultats récupérés');
  
		return { simulation_id, results }; // Retourner l'ID de simulation et les résultats.
	  } catch (error) {
		progressCallback('Erreur lors de la simulation :' + error, 0); // Indiquer une erreur.
		console.error('Erreur lors de la simulation:', error);
		return null; // Retourner null en cas d'erreur.
	  } finally {
		console.log('Chaîne d\'opérations terminée'); // Indiquer que toutes les opérations sont terminées.
	  }
	}
  
	/**
	 * Méthode pour créer une simulation dans la base de données.
	 * @param params - Les paramètres nécessaires pour créer la simulation.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	CreateSimulation(params: any): Promise<any> {
	  return this.http.post(`${this.baseUrl}/api/create_simulation`, params).toPromise()
		.then(response => {
		  console.log('Create simulation in the database...'); // Log lors de la création.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour exécuter la similarité spatiale.
	 * @param simulation_id - L'identifiant de la simulation.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	runSpatialSimilarity(simulation_id: string): Promise<any> {
	  return this.http.post(`${this.baseUrl}/api/run_spatial_similarity/${simulation_id}`, { simulation_id }).toPromise()
		.then(response => {
		  console.log('Running spatial similarity'); // Log lors de l'exécution.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour exécuter la similarité temporelle.
	 * @param simulation_id - L'identifiant de la simulation.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	runTimeseriesSimilarity(simulation_id: string): Promise<any> {
	  return this.http.post(`${this.baseUrl}/api/run_timeseries_similarity/${simulation_id}`, { simulation_id }).toPromise()
		.then(response => {
		  console.log('Running timeseries similarity'); // Log lors de l'exécution.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour exécuter les scénarios associés à une simulation.
	 * @param simulation_id - L'identifiant de la simulation.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	runScenarios(simulation_id: string): Promise<any> {
	  return this.http.post(`${this.baseUrl}/api/select_scenarios/${simulation_id}`, { simulation_id }).toPromise()
		.then(response => {
		  console.log('Running scenarios'); // Log lors de l'exécution.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour récupérer les résultats de prévision associés à une simulation.
	 * @param taskId - L'identifiant de la tâche de simulation.
	 * @returns Une promesse contenant les résultats de prévision.
	 */
	getForecastResults(taskId: string): Promise<any> {
	  return this.http.get(`${this.baseUrl}/api/simulateur/getForecastResults/` + taskId).toPromise()
		.then(response => {
		  console.log('Generating graph...'); // Log lors de la génération des résultats.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour récupérer les valeurs des indicateurs pour une simulation donnée.
	 * @param simulation_id - L'identifiant de la simulation.
	 * @returns Une promesse contenant les valeurs des indicateurs.
	 */
	get_indicators_value(simulation_id: string): Promise<any> {
	  return this.http.get(`${this.baseUrl}/api/simulateur/get_indicators_value/` + simulation_id).toPromise()
		.then(response => {
		  console.log('Fetching M10 values...'); // Log lors de la récupération des valeurs.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour supprimer un indicateur associé à une simulation.
	 * @param simulationId - L'identifiant de la simulation.
	 * @param indicatorType - Le type d'indicateur à supprimer.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	removeIndicator(simulationId: string, indicatorType: string): Promise<any> {
	  const url = `${this.baseUrl}/api/simulateur/remove_indicator/${simulationId}`; // Construction de l'URL.
	  return this.http.post(url, { type: indicatorType }).toPromise(); // Envoi d'une requête POST pour supprimer l'indicateur.
	}
  
	/**
	 * Méthode pour mettre à jour les valeurs des indicateurs d'une simulation.
	 * @param simulation_id - L'identifiant de la simulation.
	 * @param indicators - Un tableau d'indicateurs à mettre à jour.
	 * @returns Une promesse contenant la réponse de l'API après mise à jour.
	 */
	updateIndicatorsValue(simulation_id: string, indicators: any[]): Promise<any> {
	  const updatePromises = indicators.map(indicator => {
		console.log("Updating indicator:", indicator.type); // Log lors de la mise à jour de chaque indicateur.
		return this.http.post(`${this.baseUrl}/api/simulateur/update_indicator/${simulation_id}`, indicator).toPromise(); // Envoi d'une requête POST pour chaque indicateur.
	  });
  
	  return Promise.all(updatePromises) // Attendre que toutes les mises à jour soient terminées.
		.then(() => {
		  console.log('All indicators updated'); // Log lorsque toutes les mises à jour sont terminées.
		  return this.get_indicators_value(simulation_id); // Récupérer les valeurs mises à jour des indicateurs.
		});
	}
  
	/**
	 * Méthode pour mettre à jour la valeur M10 d'un indicateur.
	 * @param params - Les paramètres nécessaires pour mettre à jour l'indicateur.
	 * @returns Une promesse contenant la réponse de l'API.
	 */
	updateM10Value(params: any): Promise<any> {
	  return this.http.post(`${this.baseUrl}/api/update_indicator`, params).toPromise()
		.then(response => {
		  console.log('Fetching M10 values...'); // Log lors de la mise à jour de M10.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour récupérer la matrice de corrélation d'une simulation.
	 * @param taskId - L'identifiant de la tâche de simulation.
	 * @returns Une promesse contenant la matrice de corrélation.
	 */
	getCorrMatrix(taskId: string): Promise<any> {
	  return this.http.get(`${this.baseUrl}/api/simulateur/getCorrMatrix/` + taskId).toPromise()
		.then(response => {
		  console.log('Fetching correlation matrix...'); // Log lors de la récupération de la matrice.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour récupérer les résultats d'une simulation.
	 * @param taskId - L'identifiant de la tâche de simulation.
	 * @returns Une promesse contenant les résultats de la simulation.
	 */
	getResults(taskId: string): Promise<any> {
	  return this.http.get(`${this.baseUrl}/api/results/` + taskId).toPromise()
		.then(response => {
		  console.log('Fetching results...'); // Log lors de la récupération des résultats.
		  return response; // Retourner la réponse de l'API.
		});
	}
  
	/**
	 * Méthode pour récupérer les simulations de l'utilisateur.
	 * @returns Un Observable contenant un tableau de simulations.
	 */
	getUserSimulations(): Observable<any[]> {
	  return this.http.get<any[]>(`${this.baseUrl}/api/simulations`, { withCredentials: true }); // Envoi d'une requête GET pour récupérer les simulations.
	}
  
	/**
	 * Méthode pour récupérer une simulation beta par index.
	 * @param index - L'index de la simulation beta.
	 * @returns Un Observable contenant un tableau de simulations beta.
	 */
	getBetaSimulation(index: string): Observable<any[]> {
	  return this.http.get<any[]>(`${this.baseUrl}/api/getBetaSimulations/` + index); // Envoi d'une requête GET pour récupérer les simulations beta.
	}
  }