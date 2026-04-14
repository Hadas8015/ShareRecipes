// קומפוננטת Navbar - תפריט ניווט עליון עם קישורים דינמיים לפי הרשאות

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  constructor(
    private router: Router,
    private userService: UserService
  ) { }

  /* בדיקה אם המשתמש מחובר */
  isLoggedIn(): boolean { 
    return this.userService.isLoggedIn(); 
  }
  
  /* בדיקה אם המשתמש הוא מנהל */
  isAdmin(): boolean {
    return this.userService.isAdmin();
  }
  
  /* התנתקות וניווט לדף הכניסה */
  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']); 
  }
}