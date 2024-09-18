import { Component,EventEmitter, OnInit, ViewEncapsulation, Output, Input } from '@angular/core';
import { AuthService } from 'src/app/service/auth.service';
import {MatTabsModule} from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { Documentation } from 'src/app/baseSite/documentation/documentation';


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
  selectLang:string="";
  transLang : string[] =[];

  constructor(public translate: TranslateService,public authService : AuthService, public dialog : MatDialog ){
    translate.setDefaultLang('FR');
    translate.addLangs(['EN', 'FR']);
    translate.use('FR');
    this.selectLang = translate.currentLang;
  }

    
  setTransLanguage(){
    this.translate.use(this.selectLang);
  }

  getTransLanguage(){
    this.transLang=[...this.translate.getLangs()];
  }
  ngOnInit(){
    this.getTransLanguage();
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
  simulator(){
    console.log("User clicked on settings page");
  }
  history(){
    console.log("User clicked on settings page");
  }
  
  ficheSite(){
    console.log("User clicked on fiche de site page");
  }
  createAccount(){
    console.log("User clicked on fiche de create account page");
  }

  openDialog() {
    this.dialog.open(Documentation, {});
  }
}

