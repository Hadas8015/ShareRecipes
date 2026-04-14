// קומפוננטת Footer - ניווט תחתון עם קישורים דינמיים לפי הרשאות המשתמש

import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-footer',
  imports: [RouterModule, CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  
  constructor(private userService: UserService) {}

  /* בדיקה אם המשתמש מחובר */
  isLoggedIn(): boolean {
    return this.userService.isLoggedIn();
  }

  /* בדיקה אם המשתמש הוא מנהל */
  isAdmin(): boolean {
    return this.userService.isAdmin();
  }
}