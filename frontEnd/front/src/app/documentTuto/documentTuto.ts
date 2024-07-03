import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'another-dialog',
  templateUrl: './app-dialog.html',
  styleUrls: ['./app-dialog.scss'],
})
export class AnotherDialog {
  constructor(public dialogRef: MatDialogRef<AnotherDialog>) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
