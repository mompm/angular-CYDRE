// node v18.16.0
// npm v6.14.18
// primeng v16.0.0



import { Component, OnInit} from '@angular/core';
import {slideInAnimation} from "./animations/animations";
import {MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import { CommonModule } from '@angular/common';
import {MatTabsModule} from '@angular/material/tabs';
import { AnotherDialog } from './documentTuto/documentTuto';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    slideInAnimation
  ]
})
export class AppComponent implements OnInit{
  title = 'front';


  // <!-- for testing purposes -->
  isEndedTest: boolean = false;
  listPositions : string[] = [];
  public mousePosition: string = "Hover over test element to get mouse position";
  public log(event: any) {
    this.listPositions.push(event.x+','+(event.y*-1));
  }
  constructor(public dialog : MatDialog){}
  ngOnInit(): void {
    this.openDialog();
  }
  openDialog() {
    this.dialog.open(AnotherDialog);
  }

}

  


