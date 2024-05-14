import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {private username: string | null = null;
  private password: string | null = null;
  private role: string | null = null;
  private isLoggedIn: boolean = false;
  private isLogging : boolean = true;
  private authUrl = 'http://localhost:5000/login';
  
  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string) : Observable<any> {
    return this.http.post<any>(this.authUrl, { username, password }).pipe(
      tap(response => {
        this.username = response.username;
        this.role = response.role;
        this.isLoggedIn = true;
        console.log("logged in")
        // this.router.navigate(['/create-account']);
      })
    );
  }

  logout() {
    this.username = null;
    this.password = null;
    this.role = null;
    this.isLoggedIn = false;
    this.router.navigate(['/home']);
  }

  getUser() {
    return {
      username: this.username,
      role: this.role
    };
  }
  getIsDev() {
    return this.role ==='dev';
  }

  getIsLoggedIn() {
    return this.isLoggedIn;
  }
  getIsScientific(){
    return this.role==='scientifique'
  }
  
  getIsScientificOrDev(){
    return this.role === 'scientifique' || this.role === 'dev';
  }
}

