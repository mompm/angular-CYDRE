import { Component, ViewEncapsulation,Input } from '@angular/core';
import {MatDialog,MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatTabsModule} from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';




@Component({
  selector: 'app-selecteurLangue',
  templateUrl: './selecteurLangue.component.html',
  styleUrls: ['./selecteurLangue.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SelecteurLangueComponent{
    //variable isLoggedIn est récuperer dans le component navbar 
    @Input() isLoggedIn!: boolean;
    selectLang:string="";
    transLang : string[] =[];
  
    constructor(public translate: TranslateService, public dialog : MatDialog){
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
    }



    openDialog() {
      this.dialog.open(DocumentationPopup);
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