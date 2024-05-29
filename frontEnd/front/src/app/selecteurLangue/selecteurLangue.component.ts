import { Component, ViewEncapsulation,Input } from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import {MatTabsModule} from '@angular/material/tabs';


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
      this.dialog.open(DocumentationPopup, {
        width: '95%',
        height: 'auto'
      });
    }
  
  }

    @Component({
      selector: 'documentationPopup',
      templateUrl: './documentationPopup.html',
      styleUrls: ['./documentationPopup.scss'],
      standalone: true,
      imports: [MatTabsModule, CommonModule ],
    })
    export class DocumentationPopup {
      dialogWidth: string = '95%';
      dialogHeight: string = '75%';

  updateDialogSize(tabIndex: number) {
    switch (tabIndex) {
      case 0:
        this.dialogWidth = '95%';
        this.dialogHeight = '200px';
        break;
      case 1:
        this.dialogWidth = '95%';
        this.dialogHeight = '300px';
        break;
      case 2:
        this.dialogWidth = '95%';
        this.dialogHeight = '400px';
        break;
      case 3:
        this.dialogWidth = '95%';
        this.dialogHeight = '500px';
        break;
      default:
        this.dialogWidth = '95%';
        this.dialogHeight = '200px';
    }
  }
}