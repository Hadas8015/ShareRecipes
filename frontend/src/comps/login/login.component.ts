// קומפוננטת כניסה/הרשמה - טפסי אימות עם ולידציה ומעבר בין טאבים

import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserResponse } from '../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  activeTab: 'login' | 'register' = 'login';
  
  name: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /* מעבר בין טאב כניסה לטאב הרשמה */
  switchTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.clearMessages();
    this.clearForm();
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  clearForm(): void {
    this.name = '';
    this.email = '';
    this.password = '';
    this.confirmPassword = '';
    this.showPassword = false;
    this.showConfirmPassword = false;
  }

  /* ולידציה של הטופס - בדיקת שדות חובה, פורמט אימייל, אורך סיסמה והתאמה */
  validateForm(): boolean {
    if (this.activeTab === 'register' && !this.name) {
      this.errorMessage = 'נא להזין את שמך המלא';
      return false;
    }

    if (!this.email || !this.password) {
      this.errorMessage = 'נא למלא את כל השדות הנדרשים';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'כתובת האימייל שהוזנה אינה תקינה';
      return false;
    }

    if (this.password.length < 4) {
      this.errorMessage = 'הסיסמה חייבת להכיל לפחות 4 תווים';
      return false;
    }

    if (this.activeTab === 'register' && this.password !== this.confirmPassword) {
      this.errorMessage = 'הסיסמאות שהוזנו אינן תואמות';
      return false;
    }

    return true;
  }

  /* טיפול באימות מוצלח - שמירת משתמש וניווט לדף הבית */
  private handleSuccessfulAuth(user: UserResponse, message: string): void {
    this.successMessage = message;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.userService.saveCurrentUser(user);
      this.router.navigate(['/home']);
    }, 1500);
  }

  /* הרשמה למערכת */
  register(): void {
    this.clearMessages();
    
    if (!this.validateForm()) {
      this.cdr.detectChanges();
      return;
    }

    this.userService.register(this.name, this.email, this.password).subscribe({
      next: (response) => {
        this.handleSuccessfulAuth(response.user, `${this.name} נרשמת בהצלחה! מעביר אותך לדף הבית...`);
      },
      error: (err) => {
        if (err.status === 400) {
          this.errorMessage = err.error?.message?.includes('Email already registered')
            ? 'כתובת האימייל כבר רשומה במערכת. נא עבור לדף הכניסה'
            : `שגיאה בהרשמה: ${err.error?.message ?? 'נתונים לא תקינים'}`;
        } else if (err.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. נא ודאו שהשרת פועל';
        } else {
          this.errorMessage = `אירעה שגיאה: ${err.error?.message ?? 'שגיאה לא ידועה'}`;
        }
        this.cdr.detectChanges();
      }
    });
  }

  /* כניסה למערכת */
  login(): void {
    this.clearMessages();
    
    if (!this.validateForm()) {
      this.cdr.detectChanges();
      return;
    }

    this.userService.login(this.email, this.password).subscribe({
      next: (response) => {
        const displayName = response.user.name || response.user.email;
        this.handleSuccessfulAuth(response.user, `התחברת בהצלחה! ברוך שובך, ${displayName}`);
      },
      error: (err) => {
        if (err.status === 401) {
          this.errorMessage = 'כתובת האימייל או הסיסמה שגויים. נא נסו שנית';
        } else if (err.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. נא ודאו שהשרת פועל';
        } else {
          this.errorMessage = `אירעה שגיאה בתהליך ההתחברות: ${err.error?.message ?? 'שגיאה לא ידועה'}`;
        }
        this.cdr.detectChanges();
      }
    });
  }
}