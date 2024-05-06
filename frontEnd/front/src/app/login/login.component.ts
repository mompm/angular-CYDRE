import {Component, OnInit} from '@angular/core';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{
  username: string | undefined;
  password: string | undefined;

  constructor(public authService : AuthService, private router : Router){}
  ngOnInit() {
    this.authService.isLogging = true;
  }

  onSubmit() {
    // TODO: Implement login logic here
    //console.log(`Username: ${this.username}, Password: ${this.password}`);
    this.authService.isLoggedIn = true;
    this.authService.isLogging = false;
    this.router.navigateByUrl("");
    if(this.authService.isLoggedIn) console.log("User logged in");
  }


}
