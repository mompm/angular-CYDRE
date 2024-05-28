import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, catchError, lastValueFrom, of, switchMap, takeWhile, tap, timer } from 'rxjs';
import dataGDFWatersheds from '../model/dataGDFWatersheds';
import dataGDFPiezometry from '../model/dataGDFPiezometry';
import dataDischarge from '../model/dataDischarge';
import dataGDFStation from '../model/dataGDFStation';
import dataTemperature from '../model/dataTemperature';
import dataDepth from '../model/dataDepth';
import dataPrecipitation from '../model/dataPrecipitation';



@Injectable({
  providedIn: 'root'
})
export class JsonService {
private baseUrl = 'http://localhost:5000';


  constructor(private http: HttpClient){}




	getGDFWatersheds(): Promise<Array<dataGDFWatersheds>> {
		return lastValueFrom(this.http.get<Array<dataGDFWatersheds>>("osur/GetGDFWatersheds"));
	  }
	

	getGDFStations(): Promise<Array<dataGDFStation>>{
		return lastValueFrom(this.http.get<Array<dataGDFStation>>("osur/GetGDFStations"));
	}

	getGDFPiezometry() : Promise<Array<dataGDFPiezometry>>{
		return lastValueFrom(this.http.get<Array<dataGDFPiezometry>>("/osur/getGDFPiezometry"));
	}

	getDischarge(id: string): Promise<Array<dataDischarge>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<dataDischarge>>(url));
	}

	getRunCydre(params :any ): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_cydre`, params).pipe(
		  tap(() => console.log('Running Cydre app...'))
		);
	  }
	  getGraph(taskId:string ): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/getGraph/`+taskId).pipe(
		  tap(() => console.log('Generating graph...'))
		);
	  }
	
	  getM10Values(taskId: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/get_m10_values/`+taskId).pipe(
		  tap(() => console.log('Fetching M10 values...'))
		);
	  }

	  updateM10Value(params: any): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/update_indicator`, params).pipe(
		  tap(() => console.log('Fetching M10 values...'))
		);
	  }
	
	  getCorrMatrix(taskId: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/getCorrMatrix/`+taskId).pipe(
		  tap(() => console.log('Fetching correlation matrix...'))
		);
	  }
	
	  getResults(taskId: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/results/`+taskId).pipe(
		  tap(() => console.log('Fetching results...'))
		);
	  }
	  runSpatialSimilarity(): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_spatial_similarity`,{}).pipe(
		  tap(() => console.log('Running spatial similaritiy'))
		);
	  }
	  runTimeseriesSimilarity(): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_timeseries_similarity`,{}).pipe(
		  tap(() => console.log('Running timeseries similaritiy'))
		);
	  }
	  runScenarios(): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/select_scenarios`,{}).pipe(
		  tap(() => console.log('Running scenarios'))
		);
	  }
	  
	
	  runSimulation(params : any ,progressCallback: (message: string, progress: number) => void): Observable<any> {
		let taskId: string;
	
		progressCallback('Initialisation de la simulation...', 0);
		return this.getRunCydre(params).pipe(
		  tap(response => {
			taskId = response.task_id;
			console.log(taskId)
			console.log(`${this.baseUrl}/api/simulateur/getGraph/`+taskId)
			progressCallback('Cydre app lancée.',10);
		  }),
		  switchMap(() => this.runSpatialSimilarity().pipe(
			tap(() => progressCallback('Similarités spatiales exécutées.',20))
		  )),
		  switchMap(() => this.runTimeseriesSimilarity().pipe(
			tap(() => progressCallback('Similarités temporelles exécutées',50))
		  )),
		  switchMap(() => this.runScenarios().pipe(
			tap(() => progressCallback('Scenarios exécutés.',60))
		  )),
		  switchMap(() => this.getGraph(taskId).pipe(
			tap(() => progressCallback('Graphe généré.',75))
		  )),
		  switchMap(() => this.getM10Values(taskId).pipe(
			tap(() => progressCallback('Valeurs M10 récupérées.',80))
		  )),
		  switchMap(() => this.getCorrMatrix(taskId).pipe(
			tap(() => progressCallback('Matrice de corrélation récupérée.',85))
		  )),
		  switchMap(() => this.getResults(taskId).pipe(
			tap(() => progressCallback('Résultats récupérés.',100))
		  )),
		  catchError(error => {
			progressCallback('Erreur lors de la simulation.',0);
			return of(null);
		  })
		);
	  }
	getTemperature(id: string): Promise<Array<dataTemperature>> {
		const url = `/osur/stationTemperature/${id}`;
		return lastValueFrom(this.http.get<Array<dataTemperature>>(url));
	}

	getDepth(id: string): Promise<Array<dataDepth>> {
		const url = `/osur/stationWaterTableDepth/${id}`;
		return lastValueFrom(this.http.get<Array<dataDepth>>(url));
	}

	getPrecipitation(id: string): Promise<Array<dataPrecipitation>> {
		const url = `/osur/stationPrecipitation/${id}`;
		return lastValueFrom(this.http.get<Array<dataPrecipitation>>(url));
	}

}
