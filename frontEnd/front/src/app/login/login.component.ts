import {Component, OnInit} from '@angular/core';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { UsersService } from '../service/users.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{

  username: string = '';
  password: string = '';

  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(public authService : AuthService, private router : Router, private usersService: UsersService){}
  ngOnInit() {
    // this.authService.isLogging = true;
  }

  onSubmit() {
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('User logged in:', response);
        this.successMessage='Successfully logged in as \''+ this.username+"\'"
        this.router.navigateByUrl("home");
      },
      error: (error) => {
        console.error('Error logging in:', error);
        this.errorMessage = 'Invalid credentials';
      }
    });
  }

  addUser( username : string , password:string) {
    const newUser = { username: username, password: password, role: 'scientifique' };
    console.log("adding user :", newUser)
    this.usersService.createUser(newUser).subscribe({
      next: (response) => console.log(response),
      error: (error) => console.error(error)
    });
  }


}
