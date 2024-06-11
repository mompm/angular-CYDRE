import { Component,EventEmitter, OnInit, ViewEncapsulation, Output, Input } from '@angular/core';
//import { NavigationEnd, Router } from '@angular/router';
//import { filter } from 'rxjs';
import { AuthService } from '../service/auth.service';
import {MatTabsModule} from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

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
  data(){
    console.log("User clicked on modeling page");
  }
  ficheSite(){
    console.log("User clicked on fiche de site page");
  }
  createAccount(){
    console.log("User clicked on fiche de create account page");
  }

  openDialog() {
    this.dialog.open(DocumentationPopup, {});
  }
}

@Component({
  selector: 'documentationPopup',
  templateUrl: './documentationPopup.html',
  styleUrls: ['./documentationPopup.scss'],
  standalone: true,
  imports: [MatTabsModule, CommonModule, MatButtonModule],
})
export class DocumentationPopup {
  constructor(public dialogRef: MatDialogRef<DocumentationPopup>) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
