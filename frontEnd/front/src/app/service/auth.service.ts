import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public isLoggedIn : boolean = false;
  public isLogging : boolean = false;
  constructor() { }



}
