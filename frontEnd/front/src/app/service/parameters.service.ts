import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ParametersService {

  private apiUrl = 'api/parameters';

  constructor(private http: HttpClient) { }

  getDefaultParameters(): Observable<any> {
    return this.http.get<any>(this.apiUrl+'/true');
  }
  getParameters(): Observable<any> {
    return this.http.get<any>(this.apiUrl+'/false');
  }

  updateParameters(parameters: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, parameters);
  }
}
