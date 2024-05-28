import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private apiURL = 'http://localhost:5000/users';

  constructor(private http: HttpClient) { }

  getUsers(): Observable<any> {
    return this.http.get(this.apiURL);
  }

  createUser(userData: { username: string; password: string; role: string }): Observable<any> {
    return this.http.post(this.apiURL, userData);
  }

  
}

