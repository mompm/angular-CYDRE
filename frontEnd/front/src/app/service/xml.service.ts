import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class XmlService { // service used for http requests


	constructor(private http: HttpClient){}

	getXmlNames(): Promise<Array<string>>{ // request the list of xml available
		return lastValueFrom(this.http.get<Array<string>>("osur/getxmlnames"));
	}

	getXml(xmlName:String):Promise<string> { // request the xml with xmlName
		return lastValueFrom(this.http.get(`osur/getxml/${xmlName}`, { responseType: 'text' }));
  	}

	runCydre(xml:string): Promise<any>{ // send the xml to the api in backEnd
		return lastValueFrom(this.http.post("osur/run_cydre", xml, { responseType: 'text' }));
  	}

	runCydre2(): Observable<any>{ // run the cydre app (with the local cydre project)
		return this.http.get("osur/run_cydre");
  	}
}
