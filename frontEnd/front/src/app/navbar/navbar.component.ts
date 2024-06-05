import { Component,EventEmitter, OnInit, ViewEncapsulation, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../service/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NavbarComponent {
  @Output() titleChange = new EventEmitter<string>();
  title : string = "modelingTitle";
  isLoggedIn! : boolean;

  constructor(public authService : AuthService ){

  }
  ngOnInit(){
    this.authService.isLoggedIn.subscribe((status) => {
      this.isLoggedIn = status;
    });
  }

  

  change(){
    // this.authService.isLogging = false;
  }
  logout(){
    this.authService.logout().subscribe({
      next: response => {
        console.log("Déconnexion réussie", response);
      },
      error: err => {
        console.error("Erreur lors de la déconnexion", err);
      }
    });
  }
  login(){
    // this.authService.isLogging = true;
    console.log("User clicked on login page");
  }
  home(){
    console.log("User clicked on home page");
  }
  settings(){
    console.log("User clicked on settings page");
  }
  data(){
    console.log("User clicked on modeling page");
  }
  ficheSite(){
    console.log("User clicked on fiche de site page");
  }
  createAccount(){
    console.log("User clicked on fiche de create account page");
  }
}
