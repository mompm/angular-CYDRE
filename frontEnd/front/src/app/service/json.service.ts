import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, catchError, lastValueFrom, of, switchMap, takeWhile, tap, timer } from 'rxjs';
import OldBSSData from '../model/OldBSSData';
import CorrespondancesBSSData from '../model/CorrespondanceBSSData';
import GDFWatershedsData from '../model/GDFWatershedsData';
import DFFData from '../model/DFFData';
import GDFPiezometryData  from '../model/GDFPiezometryData ';
import StationDischargedata from '../model/StationDischargedata';
import GDFStationData from '../model/GDFStationData';
import StationTemperaturedata from '../model/StationTemperaturedata';
import WaterTableDepthdata from '../model/WaterTableDepthdata';
import StationPrecipitationdata from '../model/StationPrecipitationdata';



@Injectable({
  providedIn: 'root'
})
export class JsonService {
private baseUrl = 'http://localhost:5000';


  constructor(private http: HttpClient){}


	getOldBSS() : Promise<Array<OldBSSData>> {
		return lastValueFrom(this.http.get<Array<OldBSSData>>("osur/getoldBSS"));
	}

	getCorrespondanceBSS() : Promise<Array<CorrespondancesBSSData>>{
		return lastValueFrom(this.http.get<Array<CorrespondancesBSSData>>("osur/getcorrespondanceBSS"));
	}

	getdataGDFWatersheds(): Promise<Array<GDFWatershedsData>> {
		return lastValueFrom(this.http.get<Array<GDFWatershedsData>>("osur/GetGDFWatersheds"));
	  }
	
	getdataDFF() : Promise<Array<DFFData>>{
		return lastValueFrom(this.http.get<Array<DFFData>>("osur/getdff"));
	}

	getdataGDFStations(): Promise<Array<GDFStationData>>{
		return lastValueFrom(this.http.get<Array<GDFStationData>>("osur/GetGDFStations"));
	}

	getdataGDFPiezometry() : Promise<Array<GDFPiezometryData>>{
		return lastValueFrom(this.http.get<Array<GDFPiezometryData>>("/osur/getGDFPiezometry"));
	}

	getStationDischargeData(id: string): Promise<Array<StationDischargedata>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<StationDischargedata>>(url));
	}

	// getPrevisionGraphData(selectedStation: string, sliderValue: number, simulationDate: string):Observable<any>  {
	// 	const params = new HttpParams()
	// 	  .set('watershed', selectedStation)
	// 	  .set('sliderValue', sliderValue.toString())
	// 	  .set('simulationDate', simulationDate);
	
	// 	return this.http.get<any>('http://localhost:5000/getGraph', { params });
	//   }	
	
	getRunCydre(params :any ): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/get_run_cydre`, params).pipe(
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
	
	  runSimulation(params : any ,progressCallback: (message: string, progress: number) => void): Observable<any> {
		let taskId: string;
	
		progressCallback('Initialisation de la simulation...', 0);
		return this.getRunCydre(params).pipe(
		  tap(response => {
			taskId = response.task_id;
			console.log(taskId)
			console.log(`${this.baseUrl}/api/simulateur/getGraph/`+taskId)
			progressCallback('Cydre app lancée.',50);
		  }),
		  switchMap(() => this.getGraph(taskId).pipe(
			tap(() => progressCallback('Graphe généré.',60))
		  )),
		  switchMap(() => this.getM10Values(taskId).pipe(
			tap(() => progressCallback('Valeurs M10 récupérées.',70))
		  )),
		  switchMap(() => this.getCorrMatrix(taskId).pipe(
			tap(() => progressCallback('Matrice de corrélation récupérée.',80))
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
	getStationTemperatureData(id: string): Promise<Array<StationTemperaturedata>> {
		const url = `/osur/stationTemperature/${id}`;
		return lastValueFrom(this.http.get<Array<StationTemperaturedata>>(url));
	}

	getWaterTableDepthdata(id: string): Promise<Array<WaterTableDepthdata>> {
		const url = `/osur/stationWaterTableDepth/${id}`;
		return lastValueFrom(this.http.get<Array<WaterTableDepthdata>>(url));
	}

	getStationPrecipitationdata(id: string): Promise<Array<StationPrecipitationdata>> {
		const url = `/osur/stationPrecipitation/${id}`;
		return lastValueFrom(this.http.get<Array<StationPrecipitationdata>>(url));
	}

}
