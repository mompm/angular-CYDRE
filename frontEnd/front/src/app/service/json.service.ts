import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {lastValueFrom } from 'rxjs';
import OldBSSData from '../model/OldBSSData';
import CorrespondancesBSSData from '../model/CorrespondanceBSSData';
import GDFWatershedsData from '../model/GDFWatershedsData';
import DFFData from '../model/DFFData';
import GDFPiezometryData  from '../model/GDFPiezometryData ';
import StationDischargedata from '../model/StationDischargedata';
import GDFStationData from '../model/GDFStationData';



@Injectable({
  providedIn: 'root'
})
export class JsonService {

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

	gedataGDFStations(): Promise<Array<GDFStationData>>{
		return lastValueFrom(this.http.get<Array<GDFStationData>>("osur/GetGDFStations"));
	}

	getdataGDFPiezometry() : Promise<Array<GDFPiezometryData>>{
		return lastValueFrom(this.http.get<Array<GDFPiezometryData>>("/osur/getGDFPiezometry"));
	}

	getStationDischargeData(id: string): Promise<Array<StationDischargedata>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<StationDischargedata>>(url));
	}


}
