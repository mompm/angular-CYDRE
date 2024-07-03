import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'documentation',
  templateUrl: './documentation.html',
  styleUrls: ['./documentation.scss'],
})
export class Documentation {
  constructor(public dialogRef: MatDialogRef<Documentation>) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
