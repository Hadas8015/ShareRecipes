// קומפוננטת ניהול מערכת - אישור/דחייה של בקשות להרשאת העלאת מתכונים (Admin בלבד)

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  currentUser: any = null;
  pendingRequests: any[] = [];
  loading = false;
  message = '';
  isModalOpen = false;
  currentMessage = '';
  currentUserName = '';

  constructor(
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    
    this.currentUser = this.userService.getCurrentUser();
    
    /* הגנה - רק משתמש מחובר */
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    
    /* הגנה - רק Admin */
    if (this.currentUser.role !== 'Admin') {
      alert('אין לך הרשאה לגשת לדף זה');
      this.router.navigate(['/']);
      return;
    }
    
    this.loadPendingRequests();
  }

  /* טעינת בקשות ממתינות מהשרת */
  loadPendingRequests(): void {
    this.loading = true;
    this.message = '';
    
    this.userService.getPendingRequests().subscribe({
      next: (response) => {
        this.pendingRequests = response;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('שגיאה בטעינת הבקשות:', err);
        this.message = '❌ אירעה שגיאה בטעינת הבקשות';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /* אישור משתמש כמעלה תוכן */
  approveUser(userId: number, userName: string): void {
    const confirmMsg = `האם אתה בטוח שברצונך לאשר את ${userName} כמשתמש תוכן?`;
    if (!confirm(confirmMsg)) return;
    
    this.userService.approveUser(userId).subscribe({
      next: () => {
        this.handleSuccess(userId, `✅ ${userName} אושר בהצלחה כמשתמש תוכן!`);
      },
      error: (err) => {
        console.error('שגיאה באישור המשתמש:', err);
        this.showTemporaryMessage('❌ אירעה שגיאה באישור המשתמש');
      }
    });
  }

  /* דחיית בקשת משתמש */
  rejectUser(userId: number, userName: string): void {
    const confirmMsg = `האם אתה בטוח שברצונך לדחות את הבקשה של ${userName}?\n\nהמשתמש יחזור להיות Reader ולא יוכל לבקש הרשאה שוב.`;
    if (!confirm(confirmMsg)) return;
    
    this.userService.rejectUser(userId).subscribe({
      next: () => {
        this.handleSuccess(userId, `❌ הבקשה של ${userName} נדחתה והמשתמש נחסם מלבקש הרשאה שוב`);
      },
      error: (err) => {
        console.error('שגיאה בדחיית המשתמש:', err);
        this.showTemporaryMessage('❌ אירעה שגיאה בדחיית המשתמש');
      }
    });
  }

  /* הסרת בקשה מהרשימה והצגת הודעה */
  private handleSuccess(userId: number, message: string): void {
    this.pendingRequests = this.pendingRequests.filter(u => u.id !== userId);
    this.showTemporaryMessage(message);
  }

  /* הצגת הודעה זמנית */
  private showTemporaryMessage(message: string, duration = 3000): void {
    this.message = message;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.message = '';
      this.cdr.detectChanges();
    }, duration);
  }

  /* פתיחת מודל הודעת המשתמש */
  openMessageModal(message: string, userName: string): void {
    this.currentMessage = message || 'המשתמש לא כתב הודעה';
    this.currentUserName = userName;
    this.isModalOpen = true;
  }

  /* סגירת המודל */
  closeMessageModal(): void {
    this.isModalOpen = false;
    this.currentMessage = '';
    this.currentUserName = '';
  }
}